/**
 * Schedule Service
 * 
 * Handles schedule fetch and management operations
 */

import type { Config } from '../types/config.types.js';
import type { ZoneSchedule, ScheduleFetchResult } from '../types/schedule.types.js';
import { V1ApiClient } from '../api/v1-api.js';
import { V2ApiClient } from '../api/v2-api.js';
import { AuthManager } from '../api/auth-manager.js';
import { DeviceCacheService } from './device-cache-service.js';
import { retryWithBackoff, delay } from '../../../lib/retry.js';
import { writeLog } from '../utils/logger.js';
import { V2_API } from '../api/constants.js';

export class ScheduleService {
  constructor(
    private v1Api: V1ApiClient,
    private v2Api: V2ApiClient,
    private auth: AuthManager,
    private config: Config,
    private deviceCache: DeviceCacheService
  ) {}

  /**
   * Updates the configuration used by this service
   * 
   * Called after configuration is saved via the Settings or Override Control pages.
   * 
   * @param config - Updated configuration object
   */
  async updateConfig(config: Config): Promise<void> {
    this.config = config;
  }

  /**
   * Fetches schedules for all zones using cached device list
   * @returns Schedule fetch result with all zone schedules
   */
  async fetchAllSchedules(): Promise<ScheduleFetchResult> {
    try {
      await writeLog('🔄 Fetching all zone schedules...', 'INFO');
      
      // Use cached devices instead of making V2 API call
      const cachedDevices = this.deviceCache.getDevices();
      
      if (!cachedDevices || cachedDevices.length === 0) {
        throw new Error('No cached device data available. Run zone status check first.');
      }
      
      await writeLog(`Using cached device list (${cachedDevices.length} devices)`, 'DEBUG');
      
      const schedules: ZoneSchedule[] = [];
      
      // Fetch schedule for each device using V1 API (schedules only available in V1)
      // Note: DHW zones have schedules too - they control on/off times instead of temperatures
      for (const device of cachedDevices) {
        if (!device.deviceID || !device.gatewayId) continue;
        
        try {
          await delay(1000); // Delay between API calls
          
          // Use hardcoded name for DHW, otherwise use device name
          const zoneName = device.thermostatModelType === 'DOMESTIC_HOT_WATER' 
            ? 'Domestic Hot Water' 
            : (device.name || 'Unknown Zone');
          
          const isDHW = device.thermostatModelType === 'DOMESTIC_HOT_WATER';
          await writeLog(`📡 Fetching schedule for ${zoneName} (${isDHW ? 'DHW' : 'Temperature'} zone)...`, 'INFO');
          
          const scheduleData = await this.v1Api.fetchZoneScheduleWithRetry(String(device.deviceID), isDHW);
          
          schedules.push({
            zoneId: String(device.deviceID),
            name: zoneName,
            scheduleId: scheduleData.scheduleId,
            dailySchedules: scheduleData.dailySchedules || [],
          });
          
          await writeLog(`✅ Fetched schedule for ${zoneName}`, 'INFO');
        } catch (error) {
          // Use hardcoded name for DHW in error messages too
          const zoneName = device.thermostatModelType === 'DOMESTIC_HOT_WATER' 
            ? 'Domestic Hot Water' 
            : (device.name || 'Unknown Zone');
          await writeLog(
            `⚠️  Failed to fetch schedule for ${zoneName}: ${error instanceof Error ? error.message : String(error)}`,
            'WARNING'
          );
          // Continue with other zones even if one fails
        }
      }
      
      await writeLog(`✅ Fetched ${schedules.length} zone schedule(s)`, 'INFO');
      
      return {
        success: true,
        timestamp: new Date(),
        schedules,
      };
    } catch (error) {
      await writeLog(
        `❌ Failed to fetch schedules: ${error instanceof Error ? error.message : String(error)}`,
        'ERROR'
      );
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
        schedules: [],
      };
    }
  }
}
