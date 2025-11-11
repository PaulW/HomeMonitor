/**
 * Mock API Client for EvoHome Plugin
 * 
 * Simulates V2 API responses for local testing without hitting real API rate limits.
 */

import { generateMockLocationData, generateMockSchedule, mockDelay } from './mock-data.js';
import { writeLog } from '../utils/logger.js';
import type { Device } from '../types/zone.types.js';

export class MockV2ApiClient {
  private mockDevices: Device[] = [];
  
  constructor() {
    this.mockDevices = generateMockLocationData().devices;
    writeLog('🎭 Mock API Client initialized - Using simulated data', 'INFO');
  }

  /**
   * Mock getLocationData - Returns simulated device data
   */
  async getLocationData(
    logger?: (msg: string) => void,
    tempConfig?: any
  ): Promise<{ devices: Device[] }> {
    await mockDelay(300);
    
    if (logger) {
      logger('🎭 [MOCK] Fetching location data...');
    }
    
    // Randomly update some temperatures to simulate changes
    this.mockDevices.forEach(device => {
      if (device.thermostatModelType === 'EMEA_ZONE' && device.thermostat.indoorTemperature !== undefined) {
        const variation = (Math.random() - 0.5) * 0.5; // ±0.25°C
        device.thermostat.indoorTemperature = parseFloat((device.thermostat.indoorTemperature + variation).toFixed(2));
      }
    });
    
    if (logger) {
      logger(`🎭 [MOCK] Retrieved ${this.mockDevices.length} devices`);
    }
    
    return { devices: this.mockDevices };
  }

  /**
   * Mock setTemperatureOverride - Simulates setting zone override
   */
  async setTemperatureOverrideWithRetry(
    deviceId: number,
    temperature: number,
    logger?: (msg: string) => void
  ): Promise<void> {
    await mockDelay(200);
    
    if (logger) {
      logger(`🎭 [MOCK] Setting temperature override for device ${deviceId} to ${temperature}°C`);
    }
    
    const device = this.mockDevices.find(d => d.deviceID === deviceId);
    if (device && device.thermostat.changeableValues.heatSetpoint) {
      device.thermostat.changeableValues.heatSetpoint.value = temperature;
      device.thermostat.changeableValues.heatSetpoint.status = 'TemporaryOverride';
    }
    
    if (logger) {
      logger(`🎭 [MOCK] Temperature override set successfully`);
    }
  }

  /**
   * Mock cancelZoneOverride - Simulates canceling zone override
   */
  async cancelZoneOverride(
    deviceId: number,
    isDHW: boolean,
    logger?: (msg: string) => void
  ): Promise<void> {
    await mockDelay(200);
    
    if (logger) {
      logger(`🎭 [MOCK] Canceling override for device ${deviceId}`);
    }
    
    const device = this.mockDevices.find(d => d.deviceID === deviceId);
    if (device) {
      if (isDHW) {
        device.thermostat.changeableValues.status = 'Scheduled';
        device.thermostat.changeableValues.mode = 'DHWOff';
      } else if (device.thermostat.changeableValues.heatSetpoint) {
        device.thermostat.changeableValues.heatSetpoint.status = 'Scheduled';
      }
    }
    
    if (logger) {
      logger(`🎭 [MOCK] Override canceled successfully`);
    }
  }

  /**
   * Mock resetZoneToScheduleWithRetry - Simulates resetting zone to schedule
   */
  async resetZoneToScheduleWithRetry(
    deviceId: number,
    logger?: (msg: string) => void
  ): Promise<void> {
    await mockDelay(200);
    
    if (logger) {
      logger(`🎭 [MOCK] Resetting device ${deviceId} to schedule`);
    }
    
    const device = this.mockDevices.find(d => d.deviceID === deviceId);
    if (device && device.thermostat.changeableValues.heatSetpoint) {
      device.thermostat.changeableValues.heatSetpoint.status = 'Scheduled';
    }
    
    if (logger) {
      logger(`🎭 [MOCK] Device reset to schedule successfully`);
    }
  }

  /**
   * Mock setDHWStateOverrideWithRetry - Simulates DHW boost
   */
  async setDHWStateOverrideWithRetry(
    dhwId: number,
    state: string,
    durationMinutes: number,
    logger?: (msg: string) => void
  ): Promise<void> {
    await mockDelay(200);
    
    if (logger) {
      logger(`🎭 [MOCK] Setting DHW override to ${state} for ${durationMinutes} minutes`);
    }
    
    const device = this.mockDevices.find(d => d.deviceID === dhwId);
    if (device) {
      device.thermostat.changeableValues.mode = state;
      device.thermostat.changeableValues.status = 'Temporary';
    }
    
    if (logger) {
      logger(`🎭 [MOCK] DHW override set successfully`);
    }
  }

  /**
   * Mock getSchedules - Returns simulated schedule data
   */
  async getSchedules(logger?: (msg: string) => void): Promise<any[]> {
    await mockDelay(400);
    
    if (logger) {
      logger('🎭 [MOCK] Fetching schedules...');
    }
    
    const schedules = this.mockDevices.map(device => ({
      zoneId: device.deviceID,
      zoneName: device.name || 'Unknown',
      schedule: generateMockSchedule(device.deviceID!, device.name || 'Unknown'),
    }));
    
    if (logger) {
      logger(`🎭 [MOCK] Retrieved ${schedules.length} schedules`);
    }
    
    return schedules;
  }

  /**
   * Mock updateSchedule - Simulates schedule update
   */
  async updateSchedule(
    zoneId: number,
    scheduleData: any,
    logger?: (msg: string) => void
  ): Promise<void> {
    await mockDelay(300);
    
    if (logger) {
      logger(`🎭 [MOCK] Updating schedule for zone ${zoneId}`);
    }
    
    // In mock mode, we just log the update
    if (logger) {
      logger(`🎭 [MOCK] Schedule updated successfully`);
    }
  }
}
