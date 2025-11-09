/**
 * V2 API Client
 * 
 * Handles all V2 API operations (zone status, temperature overrides)
 */

import type { Config } from '../types/config.types.js';
import type { LocationData } from '../types/zone.types.js';
import type { ApiStatsTracker } from '../services/api-stats-tracker.js';
import { AuthManager } from './auth-manager.js';
import { retryWithBackoff } from '../../../lib/retry.js';
import { writeLog } from '../utils/logger.js';
import { calculateOverrideEndTime, buildV2Headers } from '../utils/http.js';
import { V2_API } from './constants.js';
import type { V1ApiClient } from './v1-api.js';

export class V2ApiClient {
  constructor(
    private auth: AuthManager,
    private getConfig: () => Config,
    private apiStatsTracker?: ApiStatsTracker,
    private v1ApiClient?: V1ApiClient
  ) {}

  /**
   * Generic retry wrapper for operations that require V2 session
   * Handles session expiry and automatic re-authentication
   * 
   * @param operation - Function that takes sessionId and performs the operation
   * @param logger - Optional logging function
   * @param operationName - Name of operation for logging
   * @returns Result of the operation
   * @throws {Error} If operation fails after retries
   * @private
   */
  private async withSessionRetry<T>(
    operation: (sessionId: string) => Promise<T>,
    logger?: (msg: string) => void,
    operationName: string = 'operation'
  ): Promise<T> {
    try {
      const session = await retryWithBackoff(
        () => this.auth.getV2Session(this.getConfig(), logger),
        3,
        1000,
        logger
      );
      return await operation(session.sessionId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        await writeLog(`🔄 Session expired during ${operationName}, retrying with fresh authentication...`, 'INFO');
        this.auth.clearV2Session();
        
        try {
          const session = await retryWithBackoff(
            () => this.auth.getV2Session(this.getConfig(), logger),
            2,
            1000,
            logger
          );
          return await operation(session.sessionId);
        } catch (retryError) {
          await writeLog(
            `❌ Re-authentication failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
            'ERROR'
          );
          throw new Error(`Authentication failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}. Please check your EvoHome credentials.`);
        }
      }
      throw error;
    }
  }

  /**
   * Performs a PUT request to V2 API with standard error handling
   * 
   * @param url - API endpoint URL
   * @param sessionId - Session ID for authentication
   * @param body - Request body to send
   * @throws {Error} If request fails
   * @private
   */
  private async apiPut(url: string, sessionId: string, body: any): Promise<void> {
    const headers = buildV2Headers(sessionId);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await writeLog(`❌ PUT request failed with status ${response.status}`, 'ERROR');
      
      // Track failure
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordPutFailure('v2');
      }
      
      if (response.status === 401) {
        this.auth.clearV2Session();
      }
      throw new Error(`Received response code ${response.status}\n${errorText}`);
    }
    
    // Track success
    if (this.apiStatsTracker) {
      this.apiStatsTracker.recordPutSuccess('v2');
    }
  }

  /**
   * Makes an API request to the V2 endpoint
   * 
   * @param url - Full URL to request
   * @param sessionId - Session ID for authentication
   * @returns Location data from API
   * @throws {Error} If request fails or returns non-OK status
   * @private
   */
  async apiRequest(url: string, sessionId: string): Promise<LocationData> {
    const headers = buildV2Headers(sessionId);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      await writeLog(`❌ GET request failed with status ${response.status}`, 'ERROR');
      
      // Track failure
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordGetFailure('v2');
      }
      
      // If we get 401 Unauthorized, clear the cached session
      if (response.status === 401) {
        this.auth.clearV2Session();
      }
      const errorText = await response.text();
      throw new Error(`Received response code ${response.status}\n${errorText}`);
    }
    
    // Track success
    if (this.apiStatsTracker) {
      this.apiStatsTracker.recordGetSuccess('v2');
    }
    
    const data = await response.json() as LocationData | LocationData[];
    return Array.isArray(data) ? data[0] : data;
  }

  /**
   * Gets location data for all zones
   * @param logger - Optional logging function
   * @param tempConfig - Optional temporary config for testing
   * @returns Location data with all devices
   * @throws {Error} If authentication fails or API request fails
   */
  async getLocationData(logger?: (msg: string) => void, tempConfig?: Config): Promise<LocationData> {
    const activeConfig = tempConfig || this.getConfig();
    
    if (logger) logger('🌐 Fetching fresh data from API...');
    
    try {
      // First attempt with existing session (if any)
      const session = await retryWithBackoff(
        () => this.auth.getV2Session(this.getConfig(), logger, tempConfig),
        3,
        1000,
        logger
      );
      
      const data = await retryWithBackoff(
        () => this.apiRequest(
          `${V2_API.BASE_URL}${V2_API.LOCATIONS_ENDPOINT}?userId=${session.userId}&allData=True`,
          session.sessionId
        ),
        3,
        1000,
        logger
      );
      
      return data;
    } catch (error) {
      // Check if the error is a 401 (session expired)
      if (error instanceof Error && error.message.includes('401')) {
        await writeLog('🔄 Session expired during request, retrying with fresh authentication...', 'INFO');
        
        // Force clear any cached session and retry with fresh auth
        this.auth.clearV2Session();
        
        try {
          // Retry with fresh authentication (only once - if this fails, credentials are likely wrong)
          // Use activeConfig (which respects tempConfig if provided)
          const session = await retryWithBackoff(
            () => this.auth.getV2Session(activeConfig, logger),
            2, // Reduced retries for re-auth
            1000,
            logger
          );
          
          const data = await retryWithBackoff(
            () => this.apiRequest(
              `${V2_API.BASE_URL}${V2_API.LOCATIONS_ENDPOINT}?userId=${session.userId}&allData=True`,
              session.sessionId
            ),
            2, // Reduced retries for re-auth
            1000,
            logger
          );
          
          return data;
        } catch (retryError) {
          await writeLog(
            `❌ Re-authentication failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}. Please check credentials.`,
            'ERROR'
          );
          throw new Error(`Authentication failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}. Please check your EvoHome credentials in Settings.`);
        }
      }
      
      // Re-throw non-401 errors
      throw error;
    }
  }

  /**
   * Resets a zone with retry logic on 401 errors
   * Alias for cancelZoneOverrideWithRetry() - both do the same thing
   * @param deviceId - Device ID to reset
   * @param logger - Optional logging function
   * @throws {Error} If API request fails
   */
  async resetZoneToScheduleWithRetry(deviceId: number, logger?: (msg: string) => void): Promise<void> {
    // Both reset and cancel override do the same thing - send zone back to schedule
    return this.cancelZoneOverrideWithRetry(deviceId, logger);
  }

  /**
   * Sets a temporary temperature override for a zone (V2 API)
   * 
   * @param deviceId - Device ID to set override on
   * @param temperature - Target temperature in Celsius
   * @param durationMinutes - Duration in minutes (default 60)
   * @param sessionId - Session ID for authentication
   * @throws {Error} If request fails
   * @private
   */
  async setZoneTemperatureOverride(deviceId: number, temperature: number, durationMinutes: number, sessionId: string): Promise<void> {
    const url = `${V2_API.BASE_URL}${V2_API.DEVICE_HEATSETPOINT(deviceId)}`;
    const untilTime = calculateOverrideEndTime(durationMinutes);
    
    const body = {
      Value: temperature,
      Status: 'Temporary',
      NextTime: untilTime,
    };
    
    await this.apiPut(url, sessionId, body);
  }

  /**
   * Sets a zone temperature override with retry logic
   * 
   * @param deviceId - Device ID to set override on
   * @param temperature - Target temperature in Celsius
   * @param durationMinutes - Duration in minutes
   * @param logger - Optional logging function
   * @throws {Error} If override fails after retries
   */
  async setZoneTemperatureOverrideWithRetry(deviceId: number, temperature: number, durationMinutes: number, logger?: (msg: string) => void): Promise<void> {
    return this.withSessionRetry(
      (sessionId) => this.setZoneTemperatureOverride(deviceId, temperature, durationMinutes, sessionId),
      logger,
      'temperature override'
    );
  }

  /**
   * Cancels a zone override (resets to schedule)
   * Handles both temperature zones (V2 API) and DHW zones (V1 API)
   * 
   * @param deviceId - Device ID to cancel override on
   * @param sessionId - Session ID for V2 authentication (ignored for DHW)
   * @param isDHW - Whether this is a DHW zone (optional, if known)
   * @throws {Error} If request fails
   * @private
   */
  async cancelZoneOverride(deviceId: number, sessionId: string, isDHW: boolean = false): Promise<void> {
    if (isDHW) {
      // DHW zones use V1 API - delegate to V1 client
      if (!this.v1ApiClient) {
        throw new Error('V1 API client not available for DHW control');
      }
      await this.v1ApiClient.cancelDHWOverride(deviceId.toString());
    } else {
      // For temperature zones, use the V2 heatSetpoint endpoint
      const url = `${V2_API.BASE_URL}${V2_API.DEVICE_HEATSETPOINT(deviceId)}`;
      const body = {
        Value: 0.0,
        Status: 'Scheduled',
        NextTime: null,
      };
      await this.apiPut(url, sessionId, body);
    }
  }

  /**
   * Cancels a zone override with retry logic
   * 
   * @param deviceId - Device ID to cancel override on
   * @param logger - Optional logging function
   * @param isDHW - Whether this is a DHW zone
   * @throws {Error} If cancel fails after retries
   */
  async cancelZoneOverrideWithRetry(deviceId: number, logger?: (msg: string) => void, isDHW: boolean = false): Promise<void> {
    return this.withSessionRetry(
      (sessionId) => this.cancelZoneOverride(deviceId, sessionId, isDHW),
      logger,
      'cancel override'
    );
  }

  /**
   * Sets DHW state override with retry logic
   * Delegates to V1 API client (DHW control uses V1 API)
   * 
   * @param deviceId - DHW device ID
   * @param state - 'On' or 'Off'
   * @param durationMinutes - Duration in minutes
   * @param logger - Optional logging function
   * @throws {Error} If DHW override fails after retries
   */
  async setDHWStateOverrideWithRetry(deviceId: number, state: 'On' | 'Off', durationMinutes: number, logger?: (msg: string) => void): Promise<void> {
    // DHW control uses V1 API - delegate to V1 client
    if (!this.v1ApiClient) {
      throw new Error('V1 API client not available for DHW control');
    }
    await this.v1ApiClient.setDHWStateOverrideWithRetry(deviceId.toString(), state, durationMinutes, logger);
  }
}
