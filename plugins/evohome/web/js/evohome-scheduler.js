/**
 * EvoHome Scheduler JavaScript
 * 
 * Handles the schedule editor for all zones:
 * - Loads schedules for all zones from API
 * - Displays daily schedules with switchpoints
 * - Allows editing time and temperature for each switchpoint
 * - Add/remove switchpoints
 * - Save changes back to API
 */

/**
 * Current schedule data for all zones
 * @type {Object}
 */
let schedulesData = {};

/**
 * Currently selected day for timeline view
 * @type {string}
 */
let selectedDay = 'Monday';

/**
 * Loads all zone schedules from the server
 */
async function loadSchedules() {
  try {
    const data = await fetchSchedules();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load schedules');
    }
    
    // Transform API data to UI format
    schedulesData = {
      zones: data.schedules.map(zone => {
        const transformedSchedule = transformScheduleForUI(zone.dailySchedules);
        
        return {
          zoneId: zone.zoneId,
          name: zone.name,
          schedule: transformedSchedule
        };
      }),
      lastUpdate: data.lastUpdate
    };
    
    renderSchedules();
    
  } catch (error) {
    console.error('Error loading schedules:', error);
    showMessage('❌ Failed to load schedules. Please check your connection.', 'error');
    
    const container = document.getElementById('timeline-zones');
    showError(container, error.message);
  }
}

/**
 * Transforms API schedule format to UI format
 * @param {Array} dailySchedules - API format daily schedules
 * @returns {Object} UI format schedule object
 */
function transformScheduleForUI(dailySchedules) {
  const schedule = {};
  
  // Initialize all days with empty arrays
  DAYS_OF_WEEK.forEach(day => {
    schedule[day] = [];
  });
  
  
  dailySchedules.forEach(daySchedule => {
    // Handle both string day names and numeric day indices
    let dayName;
    if (typeof daySchedule.dayOfWeek === 'string') {
      dayName = daySchedule.dayOfWeek;
    } else {
      dayName = DAY_MAP[daySchedule.dayOfWeek];
    }
    
    
    if (dayName && daySchedule.switchpoints) {
      schedule[dayName] = daySchedule.switchpoints.map(sp => {
        
        // Enhanced handling for different zone types
        let result = {
          time: sp.timeOfDay ? sp.timeOfDay.substring(0, 5) : sp.TimeOfDay?.substring(0, 5) || '00:00'
        };
        
        // Check if this is a DHW switchpoint with dhwState
        if (sp.dhwState) {
          // DHW zone: preserve the dhwState field and set temperature for backwards compatibility
          result.dhwState = sp.dhwState; // "On" or "Off"
          result.temperature = sp.dhwState === 'On' ? 1 : 0;
        } else if (typeof sp.heatSetpoint !== 'undefined') {
          // Temperature zone: use heatSetpoint as temperature
          result.temperature = sp.heatSetpoint;
        } else {
          // Fallback for unknown formats - default to Off for DHW or 16.0 for temp zones
          result.temperature = 0;
        }
        
        return result;
      });
    }
  });
  
  return schedule;
}

/**
 * Renders all zone schedules in timeline view
 */
function renderSchedules() {
  if (!schedulesData.zones || schedulesData.zones.length === 0) {
    const container = document.getElementById('timeline-zones');
    showNoZones(container, 'No zones available to schedule.');
    return;
  }
  
  // Set today as default selected day
  const today = new Date();
  const todayName = DAY_MAP[today.getDay() === 0 ? 6 : today.getDay() - 1]; // Convert JS day to our format
  selectedDay = todayName;
  document.getElementById('selected-day').value = selectedDay;
  
  renderTimelineView();
}

// ============================================================================
// Timeline View Functions
// ============================================================================

/**
 * Updates timeline view when day selection changes
 */
function updateTimelineDay() {
  selectedDay = document.getElementById('selected-day').value;
  renderTimelineView();
}

/**
 * Renders the schedule for a specific day
 * @param {string} zoneId - Zone identifier
 * @param {string} day - Day name
 * @param {Array} switchpoints - Array of switchpoint objects
 * @returns {string} HTML string
 */
function renderDaySchedule(zoneId, day, switchpoints) {
  const container = document.createElement('div');
  
  if (!switchpoints || switchpoints.length === 0) {
    // Add "no switchpoints" message
    const noSwitchpoints = getTemplate('template-no-switchpoints');
    container.appendChild(noSwitchpoints);
    
    // Add "Add Switchpoint" button
    const addBtn = getTemplate('template-add-switchpoint-btn');
    const btn = addBtn.querySelector('[data-add-switchpoint]');
    btn.onclick = () => addSwitchpoint(zoneId, day);
    container.appendChild(addBtn);
    
    return container.innerHTML;
  }
  
  // Create switchpoints container
  const switchpointsDiv = document.createElement('div');
  switchpointsDiv.className = 'schedule-switchpoints';
  
  switchpoints.forEach((sp, index) => {
    const switchpoint = createSwitchpoint(
      sp,
      index,
      zoneId,
      day,
      updateSwitchpoint,
      deleteSwitchpoint
    );
    switchpointsDiv.appendChild(switchpoint);
  });
  
  container.appendChild(switchpointsDiv);
  
  // Add "Add Switchpoint" button
  const addBtn = getTemplate('template-add-switchpoint-btn');
  const btn = addBtn.querySelector('[data-add-switchpoint]');
  btn.onclick = () => addSwitchpoint(zoneId, day);
  container.appendChild(addBtn);
  
  return container.innerHTML;
}

/**
 * Activates a day tab and shows its schedule
 * @param {string} zoneId - Zone identifier
 * @param {string} day - Day name
 */
function activateDay(zoneId, day) {
  // Update tabs
  const zoneCard = document.getElementById(`zone-${zoneId}`);
  const tabs = zoneCard.querySelectorAll('.day-tab');
  tabs.forEach(tab => {
    if (tab.textContent.trim() === day) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update schedule grids
  const grids = zoneCard.querySelectorAll('.schedule-grid');
  grids.forEach(grid => {
    if (grid.dataset.day === day) {
      grid.classList.add('active');
    } else {
      grid.classList.remove('active');
    }
  });
}

/**
 * Updates a switchpoint value
 * @param {string} zoneId - Zone identifier
 * @param {string} day - Day name
 * @param {number} index - Switchpoint index
 * @param {string} field - Field to update ('time' or 'temperature')
 * @param {string} value - New value
 */
function updateSwitchpoint(zoneId, day, index, field, value) {
  const zone = schedulesData.zones.find(z => z.zoneId === zoneId);
  if (!zone || !zone.schedule[day]) return;
  
  if (field === 'temperature') {
    zone.schedule[day][index][field] = parseFloat(value);
  } else {
    zone.schedule[day][index][field] = value;
  }
}

/**
 * Adds a new switchpoint to a day
 * @param {string} zoneId - Zone identifier
 * @param {string} day - Day name
 */
function addSwitchpoint(zoneId, day) {
  const zone = schedulesData.zones.find(z => z.zoneId === zoneId);
  if (!zone) return;
  
  if (!zone.schedule[day]) {
    zone.schedule[day] = [];
  }
  
  // Add a default switchpoint at noon with 20°C
  zone.schedule[day].push({
    time: '12:00',
    temperature: 20.0
  });
  
  // Re-render the day schedule
  const grid = document.querySelector(`[data-zone="${zoneId}"][data-day="${day}"]`);
  if (grid) {
    grid.innerHTML = renderDaySchedule(zoneId, day, zone.schedule[day]);
  }
  
  showMessage('✅ Switchpoint added', 'success');
}

/**
 * Deletes a switchpoint from a day
 * @param {string} zoneId - Zone identifier
 * @param {string} day - Day name
 * @param {number} index - Switchpoint index
 */
function deleteSwitchpoint(zoneId, day, index) {
  if (!confirm('Are you sure you want to delete this switchpoint?')) {
    return;
  }
  
  const zone = schedulesData.zones.find(z => z.zoneId === zoneId);
  if (!zone || !zone.schedule[day]) return;
  
  zone.schedule[day].splice(index, 1);
  
  // Re-render the day schedule
  const grid = document.querySelector(`[data-zone="${zoneId}"][data-day="${day}"]`);
  if (grid) {
    grid.innerHTML = renderDaySchedule(zoneId, day, zone.schedule[day]);
  }
  
  showMessage('✅ Switchpoint deleted', 'success');
}

/**
 * Saves all schedule changes to the server
 */
async function saveAllSchedules() {
  showMessage('💾 Saving schedules...', 'info');
  
  try {
    const result = await saveSchedules(schedulesData.schedules || schedulesData.zones);
    
    if (result.success) {
      showMessage('✅ All schedules saved successfully!', 'success');
    } else {
      showMessage(`❌ Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage('❌ Failed to save schedules', 'error');
    console.error('Error saving schedules:', error);
  }
}

/**
 * Refreshes schedules from server
 */
function refreshSchedules() {
  showMessage('🔄 Refreshing schedules...', 'info');
  loadSchedules();
}

// ============================================================================
// Timeline View Functions
// ============================================================================

/**
 * Switches to zone cards view
 */
function switchToZoneCardsView() {
  currentView = 'cards';
  document.getElementById('view-zone-cards').classList.add('active');
  document.getElementById('view-timeline').classList.remove('active');
  document.getElementById('day-selector').style.display = 'none';
  document.getElementById('zones-container').style.display = 'block';
  document.getElementById('timeline-container').style.display = 'none';
}

/**
 * Switches to timeline view
 */
function switchToTimelineView() {
  currentView = 'timeline';
  document.getElementById('view-zone-cards').classList.remove('active');
  document.getElementById('view-timeline').classList.add('active');
  document.getElementById('day-selector').style.display = 'flex';
  document.getElementById('zones-container').style.display = 'none';
  document.getElementById('timeline-container').style.display = 'block';
  
  // Set today as default
  const today = new Date();
  const todayName = DAY_MAP[today.getDay() === 0 ? 6 : today.getDay() - 1]; // Convert JS day to our format
  selectedDay = todayName;
  document.getElementById('selected-day').value = selectedDay;
  
  renderTimelineView();
}

/**
 * Updates timeline view when day selection changes
 */
function updateTimelineDay() {
  selectedDay = document.getElementById('selected-day').value;
  renderTimelineView();
}

/**
 * Renders the timeline view for all zones
 */
function renderTimelineView() {
  const container = document.getElementById('timeline-zones');
  
  if (!schedulesData.zones || schedulesData.zones.length === 0) {
    showNoZones(container, 'No zones available to display in timeline.');
    return;
  }
  
  container.innerHTML = '';
  schedulesData.zones.forEach(zone => {
    const row = renderTimelineZoneRow(zone);
    container.appendChild(row);
  });
}

/**
 * Renders a single zone row in the timeline
 * @param {Object} zone - Zone data
 * @returns {HTMLElement} Zone row element
 */
function renderTimelineZoneRow(zone) {
  const isDHW = zone.name === 'Domestic Hot Water';
  const schedule = zone.schedule[selectedDay] || [];
  
  const row = document.createElement('div');
  row.className = 'timeline-zone-row';
  
  // Create zone name element
  const nameDiv = document.createElement('div');
  nameDiv.className = `timeline-zone-name${isDHW ? ' dhw' : ''}`;
  nameDiv.textContent = `${isDHW ? '💧' : '🌡️'} ${zone.name}`;
  row.appendChild(nameDiv);
  
  // Create schedule container
  const scheduleDiv = document.createElement('div');
  scheduleDiv.className = 'timeline-schedule';
  
  // Render segments
  const segments = renderTimelineSegments(zone.zoneId, schedule, isDHW);
  segments.forEach(segment => scheduleDiv.appendChild(segment));
  
  row.appendChild(scheduleDiv);
  
  return row;
}

/**
 * Renders timeline segments for a zone's schedule
 * @param {string} zoneId - Zone ID
 * @param {Array} switchpoints - Array of switchpoint objects
 * @param {boolean} isDHW - Whether this is a DHW zone
 * @returns {Array<HTMLElement>} Array of segment elements
 */
function renderTimelineSegments(zoneId, switchpoints, isDHW) {
  if (!switchpoints || switchpoints.length === 0) {
    const emptySegment = document.createElement('div');
    emptySegment.className = 'timeline-segment';
    emptySegment.style.cssText = 'left: 0%; width: 100%; background: #f3f4f6; color: #6b7280;';
    emptySegment.textContent = 'No schedule';
    return [emptySegment];
  }
  
  // Convert time strings to hours for calculation
  // For DHW zones, we now have dhwState information from the domesticHotWater API endpoint
  const segments = switchpoints.map(sp => ({
    time: timeStringToHours(sp.time),
    temperature: sp.temperature,
    dhwState: sp.dhwState // "On" or "Off" for DHW zones (preserved from API)
  }));
  
  const fullDaySegments = [];
  
  if (isDHW) {
    // DHW logic using the dhwState from domesticHotWater API endpoint
    
    if (segments.length === 0) {
      fullDaySegments.push({
        start: 0,
        end: 24,
        dhwState: 'Off'
      });
    } else {
      // Process DHW switchpoints with explicit states
      for (let i = 0; i < segments.length; i++) {
        const start = segments[i].time;
        const end = i < segments.length - 1 ? segments[i + 1].time : 24;
        const dhwState = segments[i].dhwState || 'Off'; // Use preserved dhwState
        
        fullDaySegments.push({
          start: start,
          end: end,
          dhwState: dhwState
        });
      }
    }
  } else {
    // Temperature zones: each switchpoint defines the temperature until the next one
    // If first segment doesn't start at 0, add a segment from 0 to first segment
    if (segments[0].time > 0) {
      fullDaySegments.push({
        start: 0,
        end: segments[0].time,
        temperature: 16.0 // Default temperature
      });
    }
    
    // Add all defined segments
    for (let i = 0; i < segments.length; i++) {
      const start = segments[i].time;
      const end = i < segments.length - 1 ? segments[i + 1].time : 24;
      
      fullDaySegments.push({
        start: start,
        end: end,
        temperature: segments[i].temperature
      });
    }
  }
  
  return fullDaySegments.map((segment, index) => {
    const left = (segment.start / 24) * 100;
    const width = ((segment.end - segment.start) / 24) * 100;
    
    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'timeline-segment';
    segmentDiv.style.left = `${left}%`;
    segmentDiv.style.width = `${width}%`;
    segmentDiv.onclick = () => editTimelineSegment(zoneId, selectedDay, index);
    
    if (isDHW) {
      // DHW segments use dhwState ("On" or "Off")
      const isOn = segment.dhwState === 'On';
      const displayText = segment.dhwState || 'Off';
      segmentDiv.classList.add(isOn ? 'dhw-on' : 'dhw-off');
      segmentDiv.textContent = displayText;
      segmentDiv.title = `${displayText} (${hoursToTimeString(segment.start)} - ${hoursToTimeString(segment.end)})`;
    } else {
      // Temperature segments use temperature values
      const color = getTemperatureColor(segment.temperature);
      const displayText = `${segment.temperature}°C`;
      segmentDiv.style.background = color;
      segmentDiv.textContent = displayText;
      segmentDiv.title = `${displayText} (${hoursToTimeString(segment.start)} - ${hoursToTimeString(segment.end)})`;
    }
    
    return segmentDiv;
  });
}

/**
 * Gets color for temperature zones based on EvoHome controller color scheme
 * @param {number} temperature - Temperature in Celsius
 * @returns {string} CSS linear gradient
 */
function getTemperatureColor(temperature) {
  if (temperature < 5) {
    // Off/Very Low: Gray
    return 'linear-gradient(135deg, #6b7280, #9ca3af)';
  } else if (temperature <= 15.5) {
    // Blue: 5-15.5°C
    return 'linear-gradient(135deg, #3b82f6, #60a5fa)';
  } else if (temperature <= 18.5) {
    // Green: 16-18.5°C
    return 'linear-gradient(135deg, #10b981, #34d399)';
  } else if (temperature <= 21.5) {
    // Yellow/Light Orange: 19-21.5°C
    return 'linear-gradient(135deg, #fbbf24, #fb923c)';
  } else if (temperature <= 24.5) {
    // Orange/Dark Orange: 22-24.5°C
    return 'linear-gradient(135deg, #f97316, #ea580c)';
  } else {
    // Red: 25-35°C
    return 'linear-gradient(135deg, #ef4444, #dc2626)';
  }
}

/**
 * Gets color for DHW segments
 * @param {boolean|string} state - DHW state (On/Off)
 * @returns {string} CSS color
 */
function getDHWColor(state) {
  return state ? '#f59e0b' : '#3b82f6'; // Amber for On, Blue for Off
}

/**
 * Handles editing of timeline segments (placeholder for now)
}

/**
 * Downloads raw schedule data from API as JSON file for inspection
 */
async function downloadRawScheduleData() {
  try {
    showMessage('🔄 Fetching raw schedule data from API...', 'info');
    
    const response = await fetch('/plugin/evohome/api/schedules/raw');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch raw schedule data: ${response.status}`);
    }
    
    const rawData = await response.json();
    
    if (!rawData.success) {
      throw new Error(rawData.error || 'Failed to fetch raw schedule data');
    }
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evohome-raw-schedules-${timestamp}.json`;
    
    // Download the raw data
    const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('✅ Raw schedule data downloaded', 'success');
    
  } catch (error) {
    console.error('Error downloading raw schedule data:', error);
    showMessage(`❌ Failed to download raw data: ${error.message}`, 'error');
  }
}

// Add download button to the interface
function addDownloadButton() {
  const header = document.querySelector('.header .actions');
  if (header && !document.getElementById('download-btn')) {
    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'download-btn';
    downloadBtn.onclick = downloadRawScheduleData;
    downloadBtn.innerHTML = '� Download Raw API Data';
    downloadBtn.style.cssText = `
      background: #10b981;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-left: 8px;
    `;
    header.appendChild(downloadBtn);
  }
}

/**
 * Handles editing of timeline segments (placeholder for now)
 * @param {string} zoneId - Zone ID
 * @param {string} day - Day name
 * @param {number} segmentIndex - Segment index
 */
function editTimelineSegment(zoneId, day, segmentIndex) {
  // For now, just show an alert - can be enhanced later for inline editing
  const zone = schedulesData.zones.find(z => z.zoneId === zoneId);
  if (zone && zone.schedule[day] && zone.schedule[day][segmentIndex]) {
    const segment = zone.schedule[day][segmentIndex];
    const newTemp = prompt(`Edit temperature for ${zone.name} at ${segment.time}:`, segment.temperature);
    
    if (newTemp !== null && !isNaN(newTemp)) {
      zone.schedule[day][segmentIndex].temperature = parseFloat(newTemp);
      renderTimelineView(); // Re-render the timeline
      showMessage('✅ Temperature updated', 'success');
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize page when ready
initializeEvohomePage('scheduler', () => {
  loadSchedules();
});

