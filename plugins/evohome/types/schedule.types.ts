/**
 * Schedule Type Definitions
 * 
 * Types for schedule data and operations
 */

/** Schedule switchpoint with time and temperature */
export interface Switchpoint {
  TimeOfDay: string;  // Format: "HH:MM:SS"
  heatSetpoint?: number;
  dhwState?: string;  // For DHW zones: "On" or "Off"
}

/** Daily schedule for a zone */
export interface DaySchedule {
  dayOfWeek: number | string;  // 0 = Sunday, 1 = Monday, etc. or day name
  switchpoints: Switchpoint[];
}

/** Complete schedule for a zone */
export interface ZoneSchedule {
  zoneId: string;
  name: string;
  scheduleId?: string;
  dailySchedules: DaySchedule[];
}

/** Result from schedule fetch operation */
export interface ScheduleFetchResult {
  success: boolean;
  timestamp: Date;
  schedules: ZoneSchedule[];
  error?: string;
}
