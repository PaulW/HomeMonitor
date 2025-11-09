/**
 * Override Service
 * 
 * Handles override detection and reset logic
 */

import type { Config } from '../types/config.types.js';
import type { Device, OverrideResetResult } from '../types/zone.types.js';
import { ZoneService } from './zone-service.js';
import { V2ApiClient } from '../api/v2-api.js';
import { AuthManager } from '../api/auth-manager.js';
import { DeviceCacheService } from './device-cache-service.js';
import { retryWithBackoff, delay } from '../../../lib/retry.js';
import { writeLog } from '../utils/logger.js';

export class OverrideService {
  constructor(
    private zoneService: ZoneService,
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
   * Checks for zones with unauthorized overrides and resets them to schedule
   * Uses cached device data from the last zone status check
   * 
   * @param cachedRawDevices - Raw device data from the last successful zone status check
   * @returns Result with reset count and details
   */
  async checkAndResetOverrides(cachedRawDevices?: Device[]): Promise<OverrideResetResult> {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    
    await writeLog('🔧 Checking for unauthorized overrides...', 'INFO');
    
    try {
      // If no cached data provided, we can't perform override check
      if (!cachedRawDevices || cachedRawDevices.length === 0) {
        const msg = 'No cached device data available for override check';
        await writeLog(msg, 'WARNING');
        return {
          success: false,
          timestamp: new Date(),
          overridesFound: 0,
          overridesReset: 0,
          error: msg,
          logs,
        };
      }
      
      // Use cached device data instead of fetching fresh data
      await writeLog('💾 Using cached device data for override check', 'DEBUG');
      
      // Filter devices that have unauthorized overrides
      const overriddenDevices = cachedRawDevices.filter(device => {
        const details = this.zoneService.getDeviceDetails(device);
        const roomName = device.name || 'Unknown';
        
        // Skip DHW devices
        if (device.thermostatModelType === 'DOMESTIC_HOT_WATER') {
          return false;
        }
        
        const isOverridden = !['Scheduled', 'N/A', 'DHWOn', 'DHWOff'].includes(details.status) && 
                             device.thermostatModelType === 'EMEA_ZONE';
        const isAllowed = this.zoneService.isOverrideAllowed(roomName);
        
        // Debug logging (synchronous)
        if (isOverridden) {
          writeLog(
            `Zone "${roomName}": Override detected (${details.status}), Allowed: ${isAllowed}`,
            'DEBUG'
          );
        }
        
        return isOverridden && !isAllowed;
      });
      
      let overridesReset = 0;
      
      if (overriddenDevices.length > 0) {
        const msg = `Found ${overriddenDevices.length} zone(s) with schedule override (not allowed at this time)`;
        logger(`🔧 ${msg}`);
        await writeLog(msg, 'INFO');
        
        // We need fresh session for reset operations, but NOT for data
        await delay(2000);
        const session = await this.auth.getV2Session(this.config, logger);
        
        for (const device of overriddenDevices) {
          const details = this.zoneService.getDeviceDetails(device);
          try {
            await delay(1000);
            await retryWithBackoff(
              () => this.v2Api.resetZoneToScheduleWithRetry(device.deviceID!, logger),
              3,
              1000,
              logger
            );
            const successMsg = `${details.name} reset to schedule`;
            logger(`✅ ${successMsg}`);
            await writeLog(successMsg, 'INFO');
            overridesReset++;
            
            // Optimistically update cached device state to reflect the reset
            this.deviceCache.updateDeviceState(device.deviceID!, 0.0, 'Scheduled');
          } catch (error) {
            const errorMsg = `Failed to reset ${details.name}`;
            logger(`❌ ${errorMsg}`);
            await writeLog(errorMsg, 'ERROR');
          }
        }
        
        logger('✨ Override resets complete!');
        await writeLog('Override resets complete', 'INFO');
      } else {
        await writeLog('No unauthorized overrides found', 'INFO');
      }
      
      await writeLog(`Override reset check completed. Overrides reset: ${overridesReset}`, 'INFO');
      
      return {
        success: true,
        timestamp: new Date(),
        overridesFound: overriddenDevices.length,
        overridesReset,
        logs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await writeLog(`Override reset check failed: ${errorMessage}`, 'ERROR');
      
      return {
        success: false,
        timestamp: new Date(),
        overridesFound: 0,
        overridesReset: 0,
        error: errorMessage,
        logs,
      };
    }
  }
}
