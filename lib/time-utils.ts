/**
 * Time Utilities
 * 
 * Helper functions for time conversion and manipulation
 * 
 * @module lib/time-utils
 */

/**
 * Time window configuration for scheduling operations
 */
export interface TimeWindow {
  /** Days of week when window is active (lowercase) */
  days: string[];
  /** Start time in HH:MM format */
  start: string;
  /** End time in HH:MM format */
  end: string;
}

/**
 * Parses time string to minutes since midnight
 * @param timeStr - Time string in HH:MM format
 * @returns Minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if current time is within a time window
 * 
 * Handles time windows that cross midnight (e.g., 23:00 to 06:00).
 * 
 * @param window - Time window configuration
 * @param date - Date to check (defaults to now)
 * @returns Whether the time is within the window
 * 
 * @example
 * const window = { days: ['monday', 'friday'], start: '09:00', end: '17:00' };
 * const isActive = isWithinTimeWindow(window);
 * // Returns true if now is Mon-Fri between 9am-5pm
 * 
 * @example
 * // Midnight crossing example
 * const nightWindow = { days: ['monday'], start: '23:00', end: '06:00' };
 * // On Monday at 23:30 -> true
 * // On Tuesday at 02:00 -> true (still Monday's window)
 * // On Tuesday at 10:00 -> false
 */
export function isWithinTimeWindow(window: TimeWindow, date: Date = new Date()): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[date.getDay()];
  
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = timeToMinutes(window.start);
  const endMinutes = timeToMinutes(window.end);
  
  const normalizedDays = window.days.map(d => d.toLowerCase());
  
  // Handle time windows that cross midnight (e.g., 23:00 to 06:00)
  if (endMinutes < startMinutes) {
    // If we're in the "end" part (after midnight), check if yesterday is in the allowed days
    if (currentMinutes <= endMinutes) {
      const yesterday = dayNames[(date.getDay() - 1 + 7) % 7];
      return normalizedDays.includes(yesterday);
    }
    // If we're in the "start" part (before midnight), check if today is in the allowed days
    if (currentMinutes >= startMinutes) {
      return normalizedDays.includes(currentDay);
    }
    return false;
  }
  
  // Normal time window (doesn't cross midnight)
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return normalizedDays.includes(currentDay);
  }
  
  return false;
}

/**
 * Converts string to Camel Case
 * @param str - String to convert
 * @returns Camel cased string
 */
export function toCamelCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
