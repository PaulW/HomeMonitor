/**
 * Mock V1 API Client
 * 
 * Provides simulated V1 API responses for local testing without real API calls.
 * Used in mock mode to provide schedule data.
 */

import type { ZoneSchedule } from '../types/schedule.types.js';
import type { DeviceCacheService } from '../services/device-cache-service.js';
import { generateMockSchedule } from './mock-data.js';

/**
 * Mock implementation of V1 API Client
 * Returns simulated schedule data without making real API calls
 */
export class MockV1ApiClient {
  constructor(private deviceCache: DeviceCacheService) {}

  /**
   * Mock fetch zone schedule - Returns simulated schedule data
   * 
   * Looks up the actual zone name from the device cache to return zone-specific schedules
   * 
   * @param zoneId - Zone device ID
   * @param isDHW - Whether this is a DHW zone
   * @returns Mock schedule data
   */
  async fetchZoneScheduleWithRetry(zoneId: string, isDHW: boolean = false): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Look up the actual zone name from cached devices
    const devices = this.deviceCache.getDevices() || [];
    const device = devices.find(d => String(d.deviceID) === zoneId);
    
    // Use the actual device name if found, otherwise use defaults
    const zoneName = device?.name || (isDHW ? 'Hot Water' : `Zone ${zoneId}`);
    const mockSchedule = generateMockSchedule(parseInt(zoneId, 10), zoneName);
    
    return {
      scheduleId: mockSchedule.scheduleId,
      dailySchedules: mockSchedule.dailySchedules,
    };
  }

  /**
   * Mock update zone schedule - Simulates updating a schedule
   * 
   * @param zoneId - Zone device ID
   * @param scheduleData - Schedule data to update
   * @returns Success response
   */
  async updateZoneScheduleWithRetry(zoneId: string, scheduleData: any): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // In mock mode, we don't actually update anything
    console.log(`🎭 [MOCK] Simulated schedule update for zone ${zoneId}`);
  }
}
