/**
 * Mock Data Generator for EvoHome Plugin
 * 
 * Provides simulated API responses for local testing without hitting real API rate limits.
 * Generates realistic data for 5 zones: Hot Water, Living Room, Kitchen, Bathroom, Bedroom
 */

import type { Device } from '../types/zone.types.js';
import type { Config } from '../types/config.types.js';

/**
 * Generates mock configuration that doesn't touch the database
 * This is a runtime-only config used when mockMode is enabled
 */
export function generateMockConfig(): Config {
  return {
    credentials: {
      username: 'mock@example.com',
      password: 'mock-password-not-used',
    },
    settings: {
      dhwSetTemp: 50.0,
      boostTemp: 1.5,
      mockMode: true,
    },
    polling: {
      zoneStatus: 5,
      overrideReset: 5,
      scheduleRefresh: 30,
    },
    overrideRules: [
      {
        roomName: 'Living Room',
        allowOverride: true,
        timeWindows: [
          {
            start: '09:00',
            end: '17:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
        ],
      },
      {
        roomName: 'Kitchen',
        allowOverride: false,
        timeWindows: [],
      },
      {
        roomName: 'Bathroom',
        allowOverride: true,
        timeWindows: [
          {
            start: '08:00',
            end: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
        ],
      },
      {
        roomName: 'Bedroom',
        allowOverride: false,
        timeWindows: [],
      },
    ],
  };
}

/**
 * Generates mock location data with 5 zones
 */
export function generateMockLocationData(): { devices: Device[] } {
  const now = new Date();
  
  const devices: Device[] = [
    // Domestic Hot Water
    {
      deviceID: 3933910,
      gatewayId: 2737284,
      thermostatModelType: 'DOMESTIC_HOT_WATER',
      name: 'Domestic Hot Water',
      thermostat: {
        indoorTemperature: 45.0,
        indoorTemperatureStatus: 'Measured',
        changeableValues: {
          mode: Math.random() > 0.5 ? 'DHWOn' : 'DHWOff',
          status: Math.random() > 0.7 ? 'Temporary' : 'Scheduled',
          state: Math.random() > 0.5 ? 'DHWOn' : 'DHWOff',
        } as any,
      },
    },
    
    // Living Room
    {
      deviceID: 3933911,
      gatewayId: 2737284,
      thermostatModelType: 'EMEA_ZONE',
      name: 'Living Room',
      thermostat: {
        indoorTemperature: parseFloat((20.5 + (Math.random() * 2 - 1)).toFixed(2)), // 19.5-21.5
        indoorTemperatureStatus: 'Measured',
        changeableValues: {
          heatSetpoint: {
            value: 21.0,
            status: Math.random() > 0.8 ? 'TemporaryOverride' : 'Scheduled',
          },
        },
      },
    },
    
    // Kitchen
    {
      deviceID: 3933912,
      gatewayId: 2737284,
      thermostatModelType: 'EMEA_ZONE',
      name: 'Kitchen',
      thermostat: {
        indoorTemperature: parseFloat((19.0 + (Math.random() * 2 - 1)).toFixed(2)), // 18-20
        indoorTemperatureStatus: 'Measured',
        changeableValues: {
          heatSetpoint: {
            value: 19.5,
            status: 'Scheduled',
          },
        },
      },
    },
    
    // Bathroom
    {
      deviceID: 3933913,
      gatewayId: 2737284,
      thermostatModelType: 'EMEA_ZONE',
      name: 'Bathroom',
      thermostat: {
        indoorTemperature: parseFloat((22.0 + (Math.random() * 1.5 - 0.75)).toFixed(2)), // 21.25-22.75
        indoorTemperatureStatus: 'Measured',
        changeableValues: {
          heatSetpoint: {
            value: 22.5,
            status: 'Scheduled',
          },
        },
      },
    },
    
    // Bedroom
    {
      deviceID: 3933914,
      gatewayId: 2737284,
      thermostatModelType: 'EMEA_ZONE',
      name: 'Bedroom',
      thermostat: {
        indoorTemperature: parseFloat((17.5 + (Math.random() * 2 - 1)).toFixed(2)), // 16.5-18.5
        indoorTemperatureStatus: 'Measured',
        changeableValues: {
          heatSetpoint: {
            value: 18.0,
            status: Math.random() > 0.9 ? 'TemporaryOverride' : 'Scheduled',
          },
        },
      },
    },
  ];
  
  return { devices };
}

/**
 * Generates mock schedule data for a zone
 */
export function generateMockSchedule(zoneId: number, zoneName: string): any {
  const isDHW = zoneName === 'Domestic Hot Water';
  
  if (isDHW) {
    // DHW schedule - uses dhwState field for compatibility with UI
    return {
      scheduleId: `dhw-${zoneId}`,
      dailySchedules: [
        {
          dayOfWeek: 'Monday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '06:00:00', dhwState: 'On' },
            { timeOfDay: '08:00:00', dhwState: 'Off' },
            { timeOfDay: '17:00:00', dhwState: 'On' },
            { timeOfDay: '22:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '06:00:00', dhwState: 'On' },
            { timeOfDay: '08:00:00', dhwState: 'Off' },
            { timeOfDay: '17:00:00', dhwState: 'On' },
            { timeOfDay: '22:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Wednesday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '06:00:00', dhwState: 'On' },
            { timeOfDay: '08:00:00', dhwState: 'Off' },
            { timeOfDay: '17:00:00', dhwState: 'On' },
            { timeOfDay: '22:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Thursday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '06:00:00', dhwState: 'On' },
            { timeOfDay: '08:00:00', dhwState: 'Off' },
            { timeOfDay: '17:00:00', dhwState: 'On' },
            { timeOfDay: '22:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Friday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '06:00:00', dhwState: 'On' },
            { timeOfDay: '08:00:00', dhwState: 'Off' },
            { timeOfDay: '17:00:00', dhwState: 'On' },
            { timeOfDay: '23:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Saturday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '07:00:00', dhwState: 'On' },
            { timeOfDay: '09:00:00', dhwState: 'Off' },
            { timeOfDay: '18:00:00', dhwState: 'On' },
            { timeOfDay: '23:00:00', dhwState: 'Off' },
          ],
        },
        {
          dayOfWeek: 'Sunday',
          switchpoints: [
            { timeOfDay: '00:00:00', dhwState: 'Off' },
            { timeOfDay: '07:00:00', dhwState: 'On' },
            { timeOfDay: '09:00:00', dhwState: 'Off' },
            { timeOfDay: '18:00:00', dhwState: 'On' },
            { timeOfDay: '23:00:00', dhwState: 'Off' },
          ],
        },
      ],
    };
  }
  
  // Temperature zone schedules - unique for each zone
  const schedules: Record<string, any> = {
    'Living Room': {
      scheduleId: `zone-${zoneId}`,
      dailySchedules: getDailySchedules([
        { time: '06:30:00', temp: 21.0 },
        { time: '09:00:00', temp: 19.0 },
        { time: '16:00:00', temp: 21.0 },
        { time: '22:30:00', temp: 18.0 },
      ]),
    },
    'Kitchen': {
      scheduleId: `zone-${zoneId}`,
      dailySchedules: getDailySchedules([
        { time: '06:00:00', temp: 19.5 },
        { time: '09:00:00', temp: 17.0 },
        { time: '16:30:00', temp: 19.5 },
        { time: '22:00:00', temp: 16.0 },
      ]),
    },
    'Bathroom': {
      scheduleId: `zone-${zoneId}`,
      dailySchedules: getDailySchedules([
        { time: '06:00:00', temp: 22.5 },
        { time: '09:00:00', temp: 18.0 },
        { time: '17:00:00', temp: 22.5 },
        { time: '23:00:00', temp: 18.0 },
      ]),
    },
    'Bedroom': {
      scheduleId: `zone-${zoneId}`,
      dailySchedules: getDailySchedules([
        { time: '06:00:00', temp: 18.0 },
        { time: '09:00:00', temp: 16.0 },
        { time: '21:00:00', temp: 18.0 },
        { time: '23:30:00', temp: 16.0 },
      ]),
    },
  };
  
  // Return specific schedule for the zone, or default if not found
  return schedules[zoneName] || {
    scheduleId: `zone-${zoneId}`,
    dailySchedules: getDailySchedules([
      { time: '07:00:00', temp: 20.0 },
      { time: '09:00:00', temp: 18.0 },
      { time: '17:00:00', temp: 20.0 },
      { time: '23:00:00', temp: 18.0 },
    ]),
  };
}

/**
 * Helper to create daily schedules for all days
 */
function getDailySchedules(switchpoints: Array<{ time: string; temp: number }>): any[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  return days.map(day => ({
    dayOfWeek: day,
    switchpoints: switchpoints.map(sp => ({
      timeOfDay: sp.time,
      heatSetpoint: sp.temp,
    })),
  }));
}

/**
 * Adds hours to a date
 */
function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Mock delay to simulate API latency
 */
export async function mockDelay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
