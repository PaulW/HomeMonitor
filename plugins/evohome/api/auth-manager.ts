/**
 * Authentication Manager
 * 
 * Handles session caching and authentication for both V1 and V2 APIs
 */

import type { Config } from '../types/config.types.js';
import type { SessionCache, TokenCache } from '../types/api.types.js';
import type { ApiStatsTracker } from '../services/api-stats-tracker.js';
import { writeLog } from '../utils/logger.js';
import { V1_API, V2_API, OAUTH2 } from './constants.js';

export class AuthManager {
  private cachedV2Session: SessionCache | null = null;
  private cachedV1Token: TokenCache | null = null;
  private lastAuthFailure: Date | null = null;
  private authFailureCount: number = 0;
  private readonly MIN_AUTH_RETRY_DELAY = 30000; // 30 seconds minimum between re-auth attempts
  private apiStatsTracker?: ApiStatsTracker;

  /**
   * @param apiStatsTracker - Optional API statistics tracker
   */
  constructor(apiStatsTracker?: ApiStatsTracker) {
    this.apiStatsTracker = apiStatsTracker;
  }

  /**
   * Checks if we should wait before attempting authentication
   * @returns milliseconds to wait, or 0 if can proceed
   */
  private getAuthRetryDelay(): number {
    if (!this.lastAuthFailure) {
      return 0;
    }

    const timeSinceLastFailure = Date.now() - this.lastAuthFailure.getTime();
    const requiredDelay = this.MIN_AUTH_RETRY_DELAY * Math.pow(2, Math.min(this.authFailureCount - 1, 3)); // Exponential backoff, max 4 minutes
    
    if (timeSinceLastFailure < requiredDelay) {
      return requiredDelay - timeSinceLastFailure;
    }

    return 0;
  }

  /**
   * Gets V2 API session with caching
   * @param config - Plugin configuration
   * @param logger - Optional logging function
   * @param tempConfig - Optional temporary config for testing
   * @returns Session data
   * @throws {Error} If authentication fails
   */
  async getV2Session(config: Config, logger?: (msg: string) => void, tempConfig?: Config): Promise<SessionCache> {
    const activeConfig = tempConfig || config;
    
    // Use cached session if available and not testing
    if (this.cachedV2Session && !tempConfig) {
      await writeLog(`🔑 Using cached V2 session - SessionID: ${this.cachedV2Session.sessionId.substring(0, 8)}...`, 'DEBUG');
      if (logger) logger('🔑 Using cached session');
      return this.cachedV2Session;
    }
    
    // Check if we need to wait before re-attempting authentication
    const waitTime = this.getAuthRetryDelay();
    if (waitTime > 0) {
      const waitSeconds = Math.ceil(waitTime / 1000);
      await writeLog(
        `⏳ Authentication rate-limited. Waiting ${waitSeconds} seconds before retry (failure count: ${this.authFailureCount})...`,
        'WARNING'
      );
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // No cached session, authenticate
    await writeLog('🆕 No cached V2 session found, authenticating...', 'INFO');
    if (logger) logger('🔐 Authenticating...');
    
    await writeLog('🔐 Attempting V2 authentication with EvoHome API...', 'INFO');
    
    const authUrl = `${V2_API.BASE_URL}${V2_API.AUTH_ENDPOINT}`;
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: activeConfig.credentials.username,
        Password: activeConfig.credentials.password,
        ApplicationId: V2_API.APPLICATION_ID,
      }),
    });

    if (!response.ok) {
      // Track authentication failure
      this.lastAuthFailure = new Date();
      this.authFailureCount++;
      
      await writeLog(`❌ V2 authentication failed with status ${response.status} (failure #${this.authFailureCount})`, 'ERROR');
      
      // Track authentication failure in stats
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthFailure('v2');
      }
      
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      try {
        const errorData = await response.json() as { message?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
          await writeLog(`❌ Error response body: ${JSON.stringify(errorData)}`, 'ERROR');
        }
      } catch (parseError) {
        // Failed to parse error response, use default message
        await writeLog(`⚠️ Could not parse error response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`, 'WARNING');
      }
      
      throw new Error(errorMessage);
    }

    // Success - reset failure tracking
    this.authFailureCount = 0;
    this.lastAuthFailure = null;

    const userData = await response.json() as { userInfo: { userID: string }; sessionId: string };
    await writeLog(`✅ V2 authentication successful - UserID: ${userData.userInfo.userID}, SessionID: ${userData.sessionId.substring(0, 8)}...`, 'INFO');
    
    // Track authentication in stats
    if (this.apiStatsTracker) {
      this.apiStatsTracker.recordAuth('v2');
    }
    
    const session = {
      userId: userData.userInfo.userID,
      sessionId: userData.sessionId,
    };
    
    // Cache the session if not using temporary config
    if (!tempConfig) {
      this.cachedV2Session = session;
      await writeLog(`💾 V2 session cached (sliding expiration - stays valid with regular API usage)`, 'INFO');
      await writeLog(`🔍 Session cached - SessionID: ${session.sessionId.substring(0, 8)}...`, 'DEBUG');
      if (logger) logger('✅ Authentication successful, session cached');
    } else {
      if (logger) logger('✅ Authentication successful (test mode - not cached)');
    }
    
    return session;
  }

  /**
   * Gets a valid V1 token (from cache or by authenticating)
   * @param config - Plugin configuration
   * @returns Bearer token
   * @throws {Error} If authentication fails
   */
  async getV1Token(config: Config): Promise<string> {
    // Check if we have a valid cached token
    if (this.cachedV1Token && this.cachedV1Token.expiresAt > new Date()) {
      await writeLog(`🔑 Using cached V1 token (expires: ${this.cachedV1Token.expiresAt.toISOString()})`, 'DEBUG');
      return this.cachedV1Token.token;
    }

    await writeLog('🔐 Authenticating with V1 API (OAuth2)...', 'INFO');

    // V1 API uses OAuth2 password grant with form-encoded credentials
    const body = new URLSearchParams({
      'grant_type': OAUTH2.GRANT_TYPE,
      'scope': OAUTH2.SCOPES,
      'Username': config.credentials.username,
      'Password': config.credentials.password,
    });

    const response = await fetch(V1_API.OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': OAUTH2.CLIENT_CREDENTIALS_BASIC,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await writeLog(`❌ V1 authentication failed with status ${response.status}: ${errorText}`, 'ERROR');
      
      // Track authentication failure in stats
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthFailure('v1');
      }
      
      throw new Error(`V1 authentication failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    
    // Track authentication in stats
    if (this.apiStatsTracker) {
      this.apiStatsTracker.recordAuth('v1');
    }
    
    // Cache the token with expiry (subtract 5 minutes for safety margin)
    const expiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);
    this.cachedV1Token = {
      token: data.access_token,
      expiresAt,
    };

    await writeLog(`✅ V1 authentication successful - Token expires: ${expiresAt.toISOString()}`, 'INFO');
    
    return data.access_token;
  }

  /**
   * Clears cached sessions (useful when we get a 401 Unauthorized)
   */
  clearSessions(): void {
    if (this.cachedV2Session) {
      writeLog('🗑️ Clearing expired/invalid V2 session cache', 'WARNING');
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthExpired('v2');
      }
    }
    if (this.cachedV1Token) {
      writeLog('🗑️ Clearing expired/invalid V1 token cache', 'WARNING');
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthExpired('v1');
      }
    }
    this.cachedV2Session = null;
    this.cachedV1Token = null;
  }

  /**
   * Clears only V2 session
   */
  clearV2Session(): void {
    if (this.cachedV2Session) {
      writeLog('🗑️ Clearing expired/invalid V2 session cache', 'WARNING');
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthExpired('v2');
      }
    }
    this.cachedV2Session = null;
  }

  /**
   * Clears only V1 token
   */
  clearV1Token(): void {
    if (this.cachedV1Token) {
      writeLog('🗑️ Clearing expired/invalid V1 token cache', 'WARNING');
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordAuthExpired('v1');
      }
    }
    this.cachedV1Token = null;
  }
}
