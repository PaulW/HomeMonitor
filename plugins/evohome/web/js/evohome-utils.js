/**
 * EvoHome-Specific Utilities
 * 
 * EvoHome API functions and plugin-specific utilities.
 * Generic utilities (time formatting, messages, etc.) are in /utils.js
 */

// ============================================================================
// EvoHome API Fetch Utilities
// ============================================================================

/**
 * Fetches EvoHome status data
 * @returns {Promise<Object>} Status data
 */
async function fetchEvohomeStatus() {
  return apiFetch('/plugin/evohome/api/status');
}

/**
 * Fetches EvoHome configuration
 * @returns {Promise<Object>} Configuration data
 */
async function fetchEvohomeConfig() {
  return apiFetch('/plugin/evohome/api/config');
}

/**
 * Fetches EvoHome polling status
 * @returns {Promise<Object>} Polling status data
 */
async function fetchPollingStatus() {
  return apiFetch('/plugin/evohome/api/polling-status');
}

/**
 * Triggers a manual check
 * @returns {Promise<Object>} Response data
 */
async function triggerManualCheck() {
  return apiFetch('/plugin/evohome/api/run', { method: 'POST' });
}

/**
 * Saves configuration to server
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Response data
 */
async function saveConfiguration(config) {
  return apiFetch('/plugin/evohome/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
}

/**
 * Fetches configuration schema
 * @returns {Promise<Object>} Schema data
 */
async function fetchConfigSchema() {
  return apiFetch('/plugin/evohome/api/schema');
}

/**
 * Saves settings to server
 * @param {Object} settings - Settings object
 * @returns {Promise<Object>} Response data
 */
async function saveSettings(settings) {
  return apiFetch('/plugin/evohome/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

/**
 * Tests API connection with credentials
 * @param {Object} credentials - Credentials object { username, password }
 * @returns {Promise<Object>} Response data
 */
async function testConnection(credentials) {
  return apiFetch('/plugin/evohome/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
}

/**
 * Fetches zone schedules
 * @returns {Promise<Object>} Schedules data
 */
async function fetchSchedules() {
  return apiFetch('/plugin/evohome/api/schedules');
}

/**
 * Saves zone schedules
 * @param {Array} schedules - Array of schedule objects
 * @returns {Promise<Object>} Response data
 */
async function saveSchedules(schedules) {
  return apiFetch('/plugin/evohome/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules })
  });
}

/**
 * Boost a zone temperature
 * @param {number} deviceId - Device ID
 * @param {number} currentTemp - Current temperature (backend will add boost amount)
 * @returns {Promise<Object>} Response data
 */
async function boostZone(deviceId, currentTemp) {
  return apiFetch('/plugin/evohome/api/boost/zone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, currentTemp })
  });
}

/**
 * Cancel a zone boost/override
 * @param {number} deviceId - Device ID
 * @returns {Promise<Object>} Response data
 */
async function cancelZoneBoost(deviceId) {
  return apiFetch('/plugin/evohome/api/boost/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId })
  });
}

/**
 * Boost DHW (Domestic Hot Water)
 * @param {number} deviceId - DHW device ID
 * @param {string} state - State ('On' or 'Off')
 * @param {number} duration - Duration in minutes
 * @returns {Promise<Object>} Response data
 */
async function boostDHW(deviceId, state, duration) {
  return apiFetch('/plugin/evohome/api/boost/dhw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, state, duration })
  });
}

/**
 * Cancel DHW boost (reset to schedule)
 * @param {number} deviceId - DHW device ID
 * @returns {Promise<Object>} Response data
 */
async function cancelDHWBoost(deviceId) {
  return apiFetch('/plugin/evohome/api/boost/dhw/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId })
  });
}
