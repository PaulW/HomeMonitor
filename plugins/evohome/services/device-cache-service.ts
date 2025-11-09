/**
 * Device Cache Service
 * 
 * Manages cached device state for optimistic UI updates.
 * Stores device data from API responses and allows updates before
 * the API reflects changes (handles eventual consistency).
 * 
 * @module plugins/evohome/services/device-cache-service
 */

import type { ZoneSchedule, DaySchedule } from '../types/schedule.types.js';

/**
 * Service for managing cached device state
 */
export class DeviceCacheService {
  /** Cached raw device data from last successful check */
  private deviceCache: any[] | null = null;
  
  /** Zone schedules for determining scheduled temperatures */
  private zoneSchedules: ZoneSchedule[] = [];

  /**
   * Updates the device cache with fresh data from API
   * IMPORTANT: This merges new data with existing cache, preserving any optimistic updates
   * that haven't been reflected in the API yet (due to API delays)
   * 
   * @param devices - Raw device data from V2 API
   */
  setDevices(devices: any[]): void {
    if (!this.deviceCache) {
      // First time - just set it
      this.deviceCache = devices;
      return;
    }

    // Merge: For each new device, check if we have optimistic updates to preserve
    devices.forEach(newDevice => {
      const existingDevice = this.deviceCache!.find(d => d.deviceID === newDevice.deviceID);
      
      if (!existingDevice) {
        // New device, just add it
        return;
      }

      // Check if we have a recent optimistic update (within last 5 seconds)
      const existingSetpoint = existingDevice.thermostat?.changeableValues?.heatSetpoint;
      const newSetpoint = newDevice.thermostat?.changeableValues?.heatSetpoint;
      
      // If existing cache has a value that's different from API, it might be an optimistic update
      // We'll preserve it for a short time to let the API catch up
      if (existingSetpoint && newSetpoint && 
          existingSetpoint.value !== newSetpoint.value &&
          existingSetpoint._optimisticUpdateTime) {
        
        const timeSinceUpdate = Date.now() - existingSetpoint._optimisticUpdateTime;
        
        if (timeSinceUpdate < 5000) {
          // Less than 5 seconds old - preserve the optimistic update
          newDevice.thermostat.changeableValues.heatSetpoint = existingSetpoint;
        }
      }
    });

    this.deviceCache = devices;
  }

  /**
   * Gets all cached devices
   * 
   * @returns Array of cached devices or null if no cache
   */
  getDevices(): any[] | null {
    return this.deviceCache;
  }

  /**
   * Updates zone schedules cache
   * 
   * @param schedules - Zone schedules data
   */
  setZoneSchedules(schedules: ZoneSchedule[]): void {
    this.zoneSchedules = schedules;
  }

  /**
   * Updates cached device state optimistically after boost/cancel operations
   * 
   * This prevents eventual consistency issues with the Evohome API by updating
   * the local cache immediately, before the API reflects the change.
   * 
   * @param deviceId - The device ID to update
   * @param temperature - The new temperature setpoint (0.0 for scheduled)
   * @param status - The new status ('Temporary' for boost, 'Scheduled' for cancel)
   */
  updateDeviceState(deviceId: number, temperature: number, status: string): void {
    if (!this.deviceCache) {
      return;
    }

    // Find device in cache
    const device = this.deviceCache.find(d => d.deviceID === deviceId);
    if (!device) {
      return;
    }

    // If temperature is 0.0 (cancel/reset), try to get the scheduled temperature
    let finalTemp = temperature;
    let shouldUpdateTemp = true;
    
    if (temperature === 0.0 && status === 'Scheduled') {
      const scheduledTemp = this.getScheduledTemperature(String(deviceId));
      if (scheduledTemp !== null) {
        finalTemp = scheduledTemp;
      } else {
        // No schedule found - keep current temperature but update status only
        shouldUpdateTemp = false;
      }
    }

    // Update the heat setpoint
    if (!device.thermostat.changeableValues.heatSetpoint) {
      device.thermostat.changeableValues.heatSetpoint = { 
        value: shouldUpdateTemp ? finalTemp : 0.0, 
        status,
        _optimisticUpdateTime: Date.now()
      };
    } else {
      if (shouldUpdateTemp) {
        device.thermostat.changeableValues.heatSetpoint.value = finalTemp;
      }
      // Always update status and timestamp
      device.thermostat.changeableValues.heatSetpoint.status = status;
      device.thermostat.changeableValues.heatSetpoint._optimisticUpdateTime = Date.now();
    }
  }

  /**
   * Updates DHW cached state optimistically after boost/cancel operations
   * 
   * @param deviceId - The DHW device ID to update
   * @param mode - The DHW mode ('DHWOn' or 'DHWOff')
   * @param status - The status ('Temporary' for boost, 'Scheduled' for following schedule)
   */
  updateDHWState(deviceId: number, mode: string, status: string): void {
    if (!this.deviceCache) {
      return;
    }

    // Find DHW device in cache
    const device = this.deviceCache.find(d => d.deviceID === deviceId);
    if (!device || device.thermostatModelType !== 'DOMESTIC_HOT_WATER') {
      return;
    }

    // Update DHW changeableValues
    if (!device.thermostat.changeableValues) {
      device.thermostat.changeableValues = {};
    }

    device.thermostat.changeableValues.mode = mode;
    device.thermostat.changeableValues.status = status;
    device.thermostat.changeableValues._optimisticUpdateTime = Date.now();
  }

  /**
   * Gets the current cached state for a device
   * 
   * @param deviceId - The device ID to get state for
   * @param getDeviceDetails - Function to process raw device into details
   * @returns Processed device details or null if not found
   */
  getDeviceState(deviceId: number, getDeviceDetails: (device: any) => any): any | null {
    if (!this.deviceCache) {
      return null;
    }

    const device = this.deviceCache.find(d => d.deviceID === deviceId);
    if (!device) {
      return null;
    }

    // Return processed device details
    return getDeviceDetails(device);
  }

  /**
   * Gets the scheduled temperature for a zone at the current time
   * 
   * @param zoneId - The zone ID to get the scheduled temperature for
   * @param date - Optional date to check (defaults to now)
   * @returns The scheduled temperature, or null if not found
   */
  getScheduledTemperature(zoneId: string, date: Date = new Date()): number | null {
    const schedule = this.zoneSchedules.find((s: ZoneSchedule) => s.zoneId === zoneId);
    if (!schedule) {
      return null;
    }

    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:00`;

    // Find the schedule for the specified day
    // Handle both string day names ("Monday") and numeric day values (0-6)
    const daySchedule = schedule.dailySchedules.find((ds: any) => {
      // If stored as string day name, compare with day name
      if (typeof ds.dayOfWeek === 'string') {
        return ds.dayOfWeek === dayNames[dayOfWeek];
      }
      // If stored as number, compare with number
      return Number(ds.dayOfWeek) === dayOfWeek;
    });

    if (!daySchedule || !daySchedule.switchpoints || daySchedule.switchpoints.length === 0) {
      return null;
    }

    // Sort switchpoints by time (handle both timeOfDay and TimeOfDay properties)
    const sortedSwitchpoints = [...daySchedule.switchpoints]
      .filter((sp: any) => {
        const timeValue = sp.timeOfDay || sp.TimeOfDay;
        return timeValue !== undefined && timeValue !== null;
      })
      .sort((a: any, b: any) => {
        const timeA = a.timeOfDay || a.TimeOfDay;
        const timeB = b.timeOfDay || b.TimeOfDay;
        return timeA.localeCompare(timeB);
      });

    if (sortedSwitchpoints.length === 0) {
      return null;
    }

    // Find the active switchpoint (most recent one before current time)
    let activeTemp: number | null = null;
    for (const sp of sortedSwitchpoints) {
      const spTime = (sp as any).timeOfDay || (sp as any).TimeOfDay;
      if (spTime <= currentTime && sp.heatSetpoint !== undefined) {
        activeTemp = sp.heatSetpoint;
      } else {
        break;
      }
    }

    // If no switchpoint found before current time, use the last switchpoint from previous day
    if (activeTemp === null && sortedSwitchpoints.length > 0) {
      const lastSwitchpoint = sortedSwitchpoints[sortedSwitchpoints.length - 1];
      if (lastSwitchpoint.heatSetpoint !== undefined) {
        activeTemp = lastSwitchpoint.heatSetpoint;
      }
    }

    return activeTemp;
  }

  /**
   * Clears all cached data
   */
  clear(): void {
    this.deviceCache = null;
    this.zoneSchedules = [];
  }
}
