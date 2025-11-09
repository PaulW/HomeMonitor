/**
 * V1 API Client
 * 
 * Handles all V1 API operations (schedule management, DHW control)
 */

import type { Config } from '../types/config.types.js';
import type { ApiStatsTracker } from '../services/api-stats-tracker.js';
import { AuthManager } from './auth-manager.js';
import { retryWithBackoff } from '../../../lib/retry.js';
import { writeLog } from '../utils/logger.js';
import { calculateOverrideEndTime } from '../utils/http.js';
import { V1_API } from './constants.js';

export class V1ApiClient {
  constructor(
    private auth: AuthManager,
    private getConfig: () => Config,
    private apiStatsTracker?: ApiStatsTracker
  ) {}

  /**
   * Fetches schedule for a specific zone
   * @param zoneId - Zone ID to fetch schedule for
   * @param isDHW - Whether this is a DHW zone (uses different endpoint)
   * @returns Schedule data from API
   * @throws {Error} If API request fails or returns non-OK status
   */
  async fetchZoneSchedule(zoneId: string, isDHW: boolean = false): Promise<any> {
    // Get V1 bearer token (OAuth2 authentication)
    const bearerToken = await this.auth.getV1Token(this.getConfig());
    
    // Choose the correct API endpoint based on zone type
    const zoneType = isDHW ? 'domesticHotWater' : 'temperatureZone';
    const url = `${V1_API.BASE_URL}${V1_API.SCHEDULE_ENDPOINT(zoneType, zoneId)}`;
    
    const headers = {
      'Authorization': `bearer ${bearerToken}`,
      'applicationId': V1_API.APPLICATION_ID,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      await writeLog(`❌ GET request failed with status ${response.status}`, 'ERROR');
      
      // Track failure
      if (this.apiStatsTracker) {
        this.apiStatsTracker.recordGetFailure('v1');
      }
      
      // If we get 401 Unauthorized, clear the cached V1 token
      if (response.status === 401) {
        this.auth.clearV1Token();
      }
      const errorText = await response.text();
      throw new Error(`Received response code ${response.status}\n${errorText}`);
    }
    
    // Track success
    if (this.apiStatsTracker) {
      this.apiStatsTracker.recordGetSuccess('v1');
    }
    
    const data = await response.json();
    return data;
  }

  /**
   * Fetches schedule with retry logic on 401 errors
   * @param zoneId - Zone ID to fetch schedule for
   * @param isDHW - Whether this is a DHW zone
   * @returns Schedule data from API
   * @throws {Error} If schedule fetch fails after retry
   */
  async fetchZoneScheduleWithRetry(zoneId: string, isDHW: boolean = false): Promise<any> {
    try {
      // First attempt with current V1 token
      return await this.fetchZoneSchedule(zoneId, isDHW);
    } catch (error) {
      // Check if the error is a 401 (token expired)
      if (error instanceof Error && error.message.includes('401')) {
        await writeLog('🔄 V1 token expired during schedule fetch, retrying with fresh token...', 'INFO');
        
        // Force clear cached V1 token and retry with fresh token
        this.auth.clearV1Token();
        
        // Retry with fresh token
        return await this.fetchZoneSchedule(zoneId, isDHW);
      } else {
        // Re-throw non-401 errors
        throw error;
      }
    }
  }

  /**
   * Sets DHW state override
   * Reference: https://github.com/watchforstock/evohome-client/blob/master/evohomeclient2/hotwater.py
   * 
   * @param dhwId - DHW device ID
   * @param state - 'On' or 'Off'
   * @param durationMinutes - Duration in minutes
   * @throws {Error} If request fails
   */
  async setDHWStateOverride(dhwId: string, state: 'On' | 'Off', durationMinutes: number): Promise<void> {
    const bearerToken = await this.auth.getV1Token(this.getConfig());
    const url = `${V1_API.BASE_URL}${V1_API.DHW_STATE_ENDPOINT(dhwId)}`;
    const untilTime = calculateOverrideEndTime(durationMinutes);

    await writeLog(`Setting DHW override to ${state} until ${untilTime}`, 'DEBUG');
    
    const body = {
      Mode: 'TemporaryOverride',
      State: state,
      UntilTime: untilTime,
    };
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await writeLog(`❌ PUT request failed with status ${response.status}\n${errorText}`, 'ERROR');
      this.apiStatsTracker?.recordPutFailure('v1');
      
      if (response.status === 401) {
        this.auth.clearV1Token();
      }
      
      throw new Error(`Received response code ${response.status}\n${errorText}`);
    }

    this.apiStatsTracker?.recordPutSuccess('v1');
  }

  /**
   * Sets DHW state override with retry logic
   * 
   * @param dhwId - DHW device ID
   * @param state - 'On' or 'Off'
   * @param durationMinutes - Duration in minutes
   * @param logger - Optional logging function
   * @throws {Error} If DHW override fails after retries
   */
  async setDHWStateOverrideWithRetry(dhwId: string, state: 'On' | 'Off', durationMinutes: number, logger?: (msg: string) => void): Promise<void> {
    await retryWithBackoff(
      () => this.setDHWStateOverride(dhwId, state, durationMinutes),
      3,
      1000,
      logger
    );
  }

  /**
   * Cancels DHW override (resets to schedule)
   * Reference: https://github.com/watchforstock/evohome-client/blob/master/evohomeclient2/hotwater.py
   * 
   * @param dhwId - DHW device ID
   * @throws {Error} If request fails
   */
  async cancelDHWOverride(dhwId: string): Promise<void> {
    const bearerToken = await this.auth.getV1Token(this.getConfig());
    const url = `${V1_API.BASE_URL}${V1_API.DHW_STATE_ENDPOINT(dhwId)}`;
    
    const body = {
      Mode: 'FollowSchedule',
      State: '',
      UntilTime: null,
    };
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await writeLog(`❌ PUT request failed with status ${response.status}\n${errorText}`, 'ERROR');
      this.apiStatsTracker?.recordPutFailure('v1');
      
      if (response.status === 401) {
        this.auth.clearV1Token();
      }
      
      throw new Error(`Received response code ${response.status}\n${errorText}`);
    }

    this.apiStatsTracker?.recordPutSuccess('v1');
  }

  /**
   * Cancels DHW override with retry logic
   * 
   * @param dhwId - DHW device ID
   * @param logger - Optional logging function
   * @throws {Error} If cancel fails after retries
   */
  async cancelDHWOverrideWithRetry(dhwId: string, logger?: (msg: string) => void): Promise<void> {
    await retryWithBackoff(
      () => this.cancelDHWOverride(dhwId),
      3,
      1000,
      logger
    );
  }
}
