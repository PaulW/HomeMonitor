/**
 * Zone Service
 * 
 * Business logic for zone status and device management
 */

import type { Config } from '../types/config.types.js';
import type { Device, DeviceDetails, RunResult } from '../types/zone.types.js';
import { V2ApiClient } from '../api/v2-api.ts';
import { writeLog } from '../utils/logger.js';
import { isWithinTimeWindow, toCamelCase, type TimeWindow } from '../../../lib/time-utils.js';

export class ZoneService {
  constructor(
    private v2Api: V2ApiClient,
    private config: Config
  ) {}

  /**
   * Updates the configuration used by this service
   * 
   * Called after configuration is saved via the Settings or Override Control pages.
   * Allows the service to use updated override rules without requiring a restart.
   * 
   * @param config - Updated configuration object
   */
  async updateConfig(config: Config): Promise<void> {
    this.config = config;
  }

  /**
   * Performs a complete EvoHome zone status check
   * @param tempConfig - Optional temporary config for testing
   * @returns RunResult with success status, devices, and statistics
   */
  async checkZoneStatus(tempConfig?: Config): Promise<RunResult> {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    
    await writeLog('Starting EvoHome check...', 'INFO');
    
    try {
      const fullData = await this.v2Api.getLocationData(logger, tempConfig);
      const deviceDetails = fullData.devices.map(device => this.getDeviceDetails(device));
      
      const failedSensors = deviceDetails.filter(d => d.isFailed).length;
      
      if (failedSensors > 0) {
        await writeLog(`Found ${failedSensors} failed sensor(s)`, 'WARNING');
      }

      await writeLog(`Check completed successfully. Devices: ${deviceDetails.length}`, 'INFO');
      
      return {
        success: true,
        timestamp: new Date(),
        devices: deviceDetails,
        rawDevices: fullData.devices, // Include raw device data for override reset
        overridesFound: 0, // No longer checking overrides in zone status
        overridesReset: 0, // No longer resetting overrides in zone status
        failedSensors,
        logs,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await writeLog(`Check failed: ${errorMsg}`, 'ERROR');
      
      return {
        success: false,
        timestamp: new Date(),
        devices: [],
        overridesFound: 0,
        overridesReset: 0,
        failedSensors: 0,
        error: errorMsg,
        logs,
      };
    }
  }

  /**
   * Processes device data and extracts details for display
   * @param device - Raw device data from API
   * @returns Processed device details
   */
  getDeviceDetails(device: Device): DeviceDetails {
    const deviceName = device.name || 'Unknown';
    
    const isSensorFailed = 
      device.thermostat.indoorTemperature === 128 &&
      device.thermostat.indoorTemperatureStatus === 'NotAvailable';
    
    const deviceCurTemp = isSensorFailed
      ? null
      : device.thermostat.indoorTemperature !== undefined
      ? device.thermostat.indoorTemperature
      : null;
    
    if (device.thermostatModelType === 'DOMESTIC_HOT_WATER') {
      const dhwMode = device.thermostat.changeableValues.mode || 'N/A'; // 'DHWOn' or 'DHWOff'
      const displayStatus = device.thermostat.changeableValues.status || 'Scheduled'; // 'Temporary', 'Scheduled', etc.
      
      return { 
        deviceID: device.deviceID,
        thermostatModelType: device.thermostatModelType,
        name: 'Domestic Hot Water', 
        curTemp: deviceCurTemp, 
        setTemp: this.config.settings.dhwSetTemp,
        status: displayStatus,
        dhwState: dhwMode, // Actual state: 'DHWOn' or 'DHWOff'
        isFailed: false
      };
    }

    const heatSetpoint = device.thermostat.changeableValues.heatSetpoint;
    
    // Check if this room is currently in an allowed override window
    const isCurrentlyAllowedToOverride = this.isOverrideAllowed(deviceName);
    
    return {
      deviceID: device.deviceID,
      thermostatModelType: device.thermostatModelType,
      name: toCamelCase(deviceName),
      curTemp: deviceCurTemp,
      setTemp: heatSetpoint?.value ?? null,
      status: heatSetpoint?.status || 'N/A',
      isFailed: isSensorFailed,
      isOverrideAllowed: isCurrentlyAllowedToOverride,
    };
  }

  /**
   * Checks if a room override is allowed at current time
   * Logic: Block with time-based restrictions
   * @param roomName - Name of the room to check
   * @param date - Date to check (defaults to now)
   * @returns Whether override is allowed (true = allow, false = should be cancelled)
   */
  isOverrideAllowed(roomName: string, date: Date = new Date()): boolean {
    const normalizedName = roomName.toLowerCase();
    
    const rule = this.config.overrideRules.find(r => 
      r.roomName.toLowerCase() === normalizedName
    );
    
    // If no rule exists, default is to ALLOW overrides
    if (!rule) {
      return true;
    }
    
    // If rule exists but allowOverride is false, ALLOW overrides (blocking disabled)
    if (!rule.allowOverride) {
      return true;
    }
    
    // If we have a rule with allowOverride=true (blocking enabled):
    // - If NO time windows specified → BLOCK ALL THE TIME (return false)
    // - If time windows specified:
    //   - Inside a blocked window → NOT ALLOWED (return false)
    //   - Outside blocked windows → ALLOWED (return true)
    if (rule.timeWindows.length === 0) {
      // No time windows = block all the time
      return false;
    }
    
    const isInBlockedWindow = rule.timeWindows.some(window => 
      isWithinTimeWindow(window, date)
    );
    
    return !isInBlockedWindow;
  }
}
