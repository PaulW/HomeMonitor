/**
 * EvoHome Template Helper
 * 
 * EvoHome-specific template functions that build UI components.
 * Generic template loading/caching is in /template-helpers.js
 */

// Track which template files have been loaded (guard against double-loading)
if (typeof window.evohomeLoadedTemplates === 'undefined') {
  window.evohomeLoadedTemplates = new Set();
}

/**
 * Loads EvoHome templates for a specific page
 * Shared templates are always loaded. Page-specific templates are loaded on demand.
 * 
 * @param {string} page - Page name: 'dashboard', 'status', 'scheduler', 'settings', or null for shared only
 * @returns {Promise<void>}
 */
async function loadEvohomeTemplates(page = null) {
  const templatesPath = '/plugins/evohome/templates/components/';
  
  // Always load shared components
  if (!window.evohomeLoadedTemplates.has('shared')) {
    await loadTemplates(templatesPath + 'shared-components.html');
    window.evohomeLoadedTemplates.add('shared');
  }
  
  // Load page-specific templates if requested
  if (page && !window.evohomeLoadedTemplates.has(page)) {
    const pageFile = `${page}-components.html`;
    await loadTemplates(templatesPath + pageFile);
    window.evohomeLoadedTemplates.add(page);
  }
}

/**
 * Standard initialization pattern for EvoHome pages
 * Loads templates and then executes the initialization callback
 * 
 * @param {string} page - Page name for template loading
 * @param {Function} initCallback - Function to call after templates are loaded
 * 
 * @example
 * // In your page's JavaScript file:
 * initializeEvohomePage('dashboard', () => {
 *   fetchDashboardData();
 *   setInterval(fetchDashboardData, 1000);
 * });
 */
function initializeEvohomePage(page, initCallback) {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadEvohomeTemplates(page);
      initCallback();
    } catch (error) {
      console.error(`Failed to initialize ${page} page:`, error);
    }
  });
}


/**
 * Creates a device table row from template
 * @param {Object} device - Device data
 * @returns {HTMLElement} Populated row element
 */
function createDeviceRow(device) {
  const row = getTemplate('template-device-row');
  
  // Determine emoji
  let emoji = '🟢';
  if (device.isFailed) {
    emoji = '🔴';
  } else if (!['Scheduled', 'N/A', 'DHWOn'].includes(device.status)) {
    emoji = '🟡';
  }
  
  // Set values
  row.querySelector('[data-emoji]').textContent = emoji;
  row.querySelector('[data-device-name]').textContent = device.name;
  
  // Add padlock icon if override blocking is active (not allowed) and not DHW
  if (device.isOverrideAllowed === false && !device.isFailed && device.name !== 'Domestic Hot Water') {
    const padlock = document.createElement('span');
    padlock.textContent = '🔒';
    padlock.title = 'Override blocking is active for this zone';
    padlock.style.cssText = 'margin-left: 6px; font-size: 14px;';
    row.querySelector('[data-override-badge]').appendChild(padlock);
  }
  
  row.querySelector('[data-current-temp]').textContent = 
    device.curTemp !== null ? device.curTemp + '°C' : 'SENSOR FAILED';
  row.querySelector('[data-set-temp]').textContent = 
    device.setTemp !== null ? device.setTemp + '°C' : 'N/A';
  row.querySelector('[data-status]').textContent = device.status;
  
  return row;
}

/**
 * Creates a day badge element
 * @param {string} day - Day abbreviation (e.g., 'Mon')
 * @param {boolean} isSelected - Whether the day is selected
 * @returns {HTMLElement} Badge element
 */
function createDayBadge(day, isSelected) {
  const badge = getTemplate('template-day-badge');
  const span = badge.querySelector('[data-day-badge]');
  
  span.textContent = day;
  span.style.background = isSelected ? '#667eea' : '#e5e7eb';
  span.style.color = isSelected ? 'white' : '#6b7280';
  
  return badge;
}

/**
 * Creates a time window display element
 * @param {Object} window - Time window data { start, end, days }
 * @param {Function} onRemove - Callback for remove button
 * @returns {HTMLElement} Time window element
 */
function createTimeWindow(window, onRemove) {
  const element = getTemplate('template-time-window');
  
  element.querySelector('[data-time-range]').textContent = `${window.start} - ${window.end}`;
  
  // Add day badges
  const dayBadgesContainer = element.querySelector('[data-day-badges]');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daysFull = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  const selectedDays = window.days.map(d => d.toLowerCase());
  days.forEach((day, idx) => {
    const isSelected = selectedDays.includes(daysFull[idx]);
    dayBadgesContainer.appendChild(createDayBadge(day, isSelected));
  });
  
  // Set up remove button
  const removeBtn = element.querySelector('[data-remove-window]');
  removeBtn.onclick = onRemove;
  
  return element;
}

/**
 * Creates a config table row
 * @param {Object} rule - Override rule data
 * @param {number} ruleIdx - Rule index
 * @param {Function} onToggle - Callback for toggle checkbox
 * @param {Function} onAdd - Callback for add window button
 * @returns {HTMLElement} Table row element
 */
function createConfigRow(rule, ruleIdx, onToggle, onAdd) {
  const row = getTemplate('template-config-row');
  
  row.querySelector('[data-room-name]').textContent = rule.roomName;
  
  const checkbox = row.querySelector('[data-allow-override]');
  checkbox.checked = rule.allowOverride;
  checkbox.onchange = (e) => onToggle(ruleIdx, e.target.checked);
  
  const windowsContainer = row.querySelector('[data-time-windows]');
  if (rule.timeWindows.length === 0) {
    windowsContainer.innerHTML = '<span style="color: #9ca3af;">No time windows</span>';
  } else {
    rule.timeWindows.forEach((window, winIdx) => {
      const windowEl = createTimeWindow(window, () => {
        if (confirm('Remove this time window?')) {
          // Callback would handle removal
        }
      });
      windowsContainer.appendChild(windowEl);
    });
  }
  
  const addBtn = row.querySelector('[data-add-window]');
  addBtn.onclick = () => onAdd(ruleIdx);
  
  return row;
}

/**
 * Creates a switchpoint element
 * @param {Object} switchpoint - Switchpoint data { time, temperature }
 * @param {number} index - Switchpoint index
 * @param {string} zoneId - Zone ID
 * @param {string} day - Day name
 * @param {Function} onChange - Callback for value changes
 * @param {Function} onDelete - Callback for delete
 * @returns {HTMLElement} Switchpoint element
 */
function createSwitchpoint(switchpoint, index, zoneId, day, onChange, onDelete) {
  const element = getTemplate('template-switchpoint');
  
  element.querySelector('[data-index]').textContent = index + 1;
  
  const timeInput = element.querySelector('[data-time-input]');
  timeInput.value = switchpoint.time;
  timeInput.onchange = (e) => onChange(zoneId, day, index, 'time', e.target.value);
  
  const tempInput = element.querySelector('[data-temp-input]');
  tempInput.value = switchpoint.temperature;
  tempInput.onchange = (e) => onChange(zoneId, day, index, 'temperature', e.target.value);
  
  const deleteBtn = element.querySelector('[data-delete-btn]');
  deleteBtn.onclick = () => onDelete(zoneId, day, index);
  
  return element;
}

/**
 * Creates a timeline segment
 * @param {Object} segment - Segment data
 * @param {boolean} isDHW - Whether this is a DHW zone
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Segment element
 */
function createTimelineSegment(segment, isDHW, onClick) {
  const element = getTemplate('template-timeline-segment');
  const div = element.querySelector('[data-segment]');
  
  const left = (segment.start / 24) * 100;
  const width = ((segment.end - segment.start) / 24) * 100;
  
  div.style.left = `${left}%`;
  div.style.width = `${width}%`;
  
  if (isDHW) {
    const isOn = segment.dhwState === 'On';
    const displayText = segment.dhwState || 'Off';
    div.classList.add(isOn ? 'dhw-on' : 'dhw-off');
    div.textContent = displayText;
    div.title = `${displayText} (${hoursToTimeString(segment.start)} - ${hoursToTimeString(segment.end)})`;
  } else {
    const color = getTemperatureColor(segment.temperature);
    const displayText = `${segment.temperature}°C`;
    div.style.background = color;
    div.textContent = displayText;
    div.title = `${displayText} (${hoursToTimeString(segment.start)} - ${hoursToTimeString(segment.end)})`;
  }
  
  if (onClick) {
    div.onclick = onClick;
  }
  
  return element;
}

/**
 * Creates a timeline zone row
 * @param {Object} zone - Zone data
 * @param {Array} segments - Timeline segments
 * @param {boolean} isDHW - Whether this is DHW
 * @returns {HTMLElement} Zone row element
 */
function createTimelineZoneRow(zone, segments, isDHW) {
  const row = getTemplate('template-timeline-zone-row');
  
  const nameEl = row.querySelector('[data-zone-name]');
  nameEl.textContent = `${isDHW ? '💧' : '🌡️'} ${zone.name}`;
  if (isDHW) nameEl.classList.add('dhw');
  
  const scheduleEl = row.querySelector('[data-timeline-schedule]');
  segments.forEach(segment => {
    scheduleEl.appendChild(createTimelineSegment(segment, isDHW));
  });
  
  return row;
}

// Note: Generic showLoading(), showError(), showNoZones() are now in /template-helpers.js
// The versions below are EvoHome-specific convenience wrappers

/**
 * Shows loading message with EvoHome template
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message
 */
function showEvohomeLoading(container, message = 'Loading...') {
  showLoading(container, 'template-loading', message);
}

/**
 * Shows error message with EvoHome template
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 */
function showEvohomeError(container, message) {
  showError(container, 'template-schedule-error', message);
}

/**
 * Shows "no zones" message with EvoHome template
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message text
 */
function showEvohomeNoZones(container, message = 'No zones available to schedule.') {
  try {
    const noZones = getTemplate('template-no-zones');
    noZones.querySelector('[data-message]').textContent = message;
    container.innerHTML = '';
    container.appendChild(noZones);
  } catch (error) {
    container.innerHTML = `<div class="no-zones">${message}</div>`;
  }
}


/**
 * Shows an error message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 */
function showError(container, message) {
  const error = getTemplate('template-schedule-error');
  error.querySelector('[data-error-message]').textContent = message;
  container.innerHTML = '';
  container.appendChild(error);
}

/**
 * Shows "no zones" message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message text
 */
function showNoZones(container, message = 'No zones available to schedule.') {
  const noZones = getTemplate('template-no-zones');
  noZones.querySelector('[data-message]').textContent = message;
  container.innerHTML = '';
  container.appendChild(noZones);
}
