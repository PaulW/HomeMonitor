/**
 * Core Utilities
 * 
 * Generic utility functions for all plugins:
 * - Time formatting
 * - Message display (status messages & toasts)
 * - API fetching with error handling
 * - UI helper functions
 * - Validation utilities
 */

// ============================================================================
// Time Formatting Utilities
// ============================================================================

/**
 * Formats a Date object to HH:MM:SS
 * @param {Date|string} date - Date to format (Date object or ISO string)
 * @returns {string} Formatted time string (HH:MM:SS)
 */
function formatTime(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a Date object to locale time string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time string (using browser locale)
 */
function formatLocaleTime(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString();
}

/**
 * Calculates countdown to next event in human-readable format
 * @param {Date|string} nextTime - Future time
 * @returns {string} Countdown string (e.g., "2m 30s", "1h 15m")
 */
function formatCountdown(nextTime) {
  if (!nextTime) return '-';
  
  const now = new Date();
  const next = typeof nextTime === 'string' ? new Date(nextTime) : nextTime;
  const diffMs = next - now;
  
  if (diffMs <= 0) return 'Now';
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculates minutes until next event
 * @param {Date|string} nextTime - Future time
 * @returns {number} Minutes remaining (rounded down)
 */
function getMinutesUntil(nextTime) {
  if (!nextTime) return 0;
  const now = new Date();
  const next = typeof nextTime === 'string' ? new Date(nextTime) : nextTime;
  return Math.floor((next - now) / 60000);
}

/**
 * Converts time string (HH:MM) to hours as decimal
 * @param {string} timeStr - Time string like "14:30"
 * @returns {number} Hours as decimal (14.5)
 */
function timeStringToHours(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

/**
 * Converts hours as decimal to time string
 * @param {number} hours - Hours as decimal (14.5)
 * @returns {string} Time string like "14:30"
 */
function hoursToTimeString(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ============================================================================
// Message Display Utilities
// ============================================================================

/**
 * Shows a status message to the user
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'success', 'error', or 'info'
 * @param {number} duration - How long to show message in ms (default: 5000)
 */
function showMessage(message, type, duration = 5000) {
  const statusEl = document.getElementById('status-message');
  if (!statusEl) {
    console.warn('Status message element not found');
    return;
  }
  
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  
  // Auto-hide after duration
  setTimeout(() => {
    statusEl.className = 'status-message';
  }, duration);
}

/**
 * Shows a toast notification in the top-right corner
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', or 'info'
 * @param {number} duration - How long to show toast in ms (default: 5000)
 */
function showToast(message, type = 'info', duration = 5000) {
  // Create container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Choose icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  // Add to container
  container.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
      // Remove container if empty
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300); // Match CSS animation duration
  }, duration);
}

// ============================================================================
// API Fetch Utilities
// ============================================================================

/**
 * Fetches data from API with error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails
 */
async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API fetch failed for ${url}:`, error);
    throw error;
  }
}

// ============================================================================
// UI Helper Utilities
// ============================================================================

/**
 * Updates status badge based on state
 * @param {string} elementId - Badge element ID
 * @param {Object} state - State object with { isRunning, lastResult }
 */
function updateStatusBadge(elementId, state) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  
  const { isRunning, lastResult } = state;
  
  if (isRunning) {
    badge.className = 'status-badge status-checking';
    badge.textContent = '● Checking...';
  } else if (lastResult && lastResult.success) {
    badge.className = 'status-badge status-online';
    badge.textContent = '● Online';
  } else if (lastResult && !lastResult.success) {
    badge.className = 'status-badge status-error';
    badge.textContent = '● Error';
  } else {
    badge.className = 'status-badge status-offline';
    badge.textContent = '● Unknown';
  }
}

/**
 * Updates next run time display
 * @param {string} elementId - Element ID to update
 * @param {Date|string} nextRunTime - Next run time
 */
function updateNextRunTime(elementId, nextRunTime) {
  const element = document.getElementById(elementId);
  if (!element || !nextRunTime) return;
  
  const mins = getMinutesUntil(nextRunTime);
  element.textContent = `Next check in ${mins} minute${mins !== 1 ? 's' : ''}`;
}

/**
 * Calculates success rate percentage
 * @param {number} successful - Number of successful runs
 * @param {number} total - Total number of runs
 * @returns {number} Success rate percentage (0-100)
 */
function calculateSuccessRate(successful, total) {
  return total > 0 ? Math.round((successful / total) * 100) : 0;
}

/**
 * Disables/enables a button with loading state
 * @param {string} buttonId - Button element ID
 * @param {boolean} disabled - Whether to disable the button
 * @param {string} text - Optional text to set (if disabled, will add ⏳ prefix)
 */
function setButtonLoading(buttonId, disabled, text = null) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  button.disabled = disabled;
  
  if (text) {
    if (disabled && !text.startsWith('⏳')) {
      button.textContent = `⏳ ${text}`;
    } else {
      button.textContent = text;
    }
  }
}

// ============================================================================
// Temperature Utilities
// ============================================================================

/**
 * Gets color for temperature-based visualization
 * @param {number} temperature - Temperature value in Celsius
 * @returns {string} CSS color code
 */
function getTemperatureColor(temperature) {
  // Color coding: Blue (5°C), Cyan (8-16°C), Yellow (16-19°C), Orange (20-22°C), Red (22+°C)
  if (temperature <= 8) {
    return '#3b82f6'; // Blue - very cold
  } else if (temperature <= 16) {
    return '#06b6d4'; // Cyan - cold
  } else if (temperature <= 19) {
    return '#eab308'; // Yellow - moderate
  } else if (temperature <= 22) {
    return '#f97316'; // Orange - warm
  } else {
    return '#ef4444'; // Red - hot
  }
}

/**
 * Formats temperature with unit
 * @param {number|null} temperature - Temperature value
 * @param {string} unit - Unit symbol (default: '°C')
 * @returns {string} Formatted temperature string
 */
function formatTemperature(temperature, unit = '°C') {
  if (temperature === null || temperature === undefined) {
    return 'N/A';
  }
  return `${temperature}${unit}`;
}

// ============================================================================
// Day/Week Utilities
// ============================================================================

/**
 * Days of the week mapping
 */
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_MAP = {
  0: 'Monday',
  1: 'Tuesday', 
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday'
};

const DAY_NAME_TO_INDEX = {
  'Monday': 0,
  'Tuesday': 1,
  'Wednesday': 2,
  'Thursday': 3,
  'Friday': 4,
  'Saturday': 5,
  'Sunday': 6
};

/**
 * Gets current day name (EvoHome format: Monday-Sunday)
 * @returns {string} Day name
 */
function getCurrentDay() {
  const today = new Date();
  const jsDay = today.getDay(); // 0=Sunday, 6=Saturday
  // Convert to EvoHome format (0=Monday, 6=Sunday)
  const evohomeDay = jsDay === 0 ? 6 : jsDay - 1;
  return DAY_MAP[evohomeDay];
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates time string format (HH:MM)
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} True if valid
 */
function isValidTimeString(timeStr) {
  if (!timeStr) return false;
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
}

/**
 * Validates temperature value
 * @param {number} temperature - Temperature to validate
 * @param {number} min - Minimum allowed temperature (default: 5)
 * @param {number} max - Maximum allowed temperature (default: 35)
 * @returns {boolean} True if valid
 */
function isValidTemperature(temperature, min = 5, max = 35) {
  return typeof temperature === 'number' && temperature >= min && temperature <= max;
}
