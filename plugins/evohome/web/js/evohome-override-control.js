let currentConfig = null;

async function fetchStatus() {
  try {
    const data = await fetchEvohomeStatus();
    updateDashboard(data);
  } catch (error) {
    console.error('Failed to fetch status:', error);
  }
}

function updateDashboard(data) {
  const { lastResult, stats, isRunning, nextRunTime } = data;
  
  // Update status badge using shared utility
  updateStatusBadge('status-badge', { isRunning, lastResult });
  
  // Update next run time using shared utility
  if (nextRunTime) {
    updateNextRunTime('next-run', nextRunTime);
  }
}

async function loadConfig() {
  try {
    const [configData, statusData] = await Promise.all([
      fetchEvohomeConfig(),
      fetchEvohomeStatus()
    ]);
    
    // Store config globally (both module and window scope)
    currentConfig = configData;
    window.currentConfig = configData;
    
    // Get all room names from last result
    const allRooms = [];
    if (statusData.lastResult && statusData.lastResult.devices) {
      statusData.lastResult.devices.forEach(device => {
        if (device.name && device.name !== 'Domestic Hot Water') {
          allRooms.push(device.name);
        }
      });
    }
    
    // Store allRooms for later use
    window.allRooms = allRooms;
    renderConfigTable(currentConfig, allRooms);
  } catch (error) {
    const container = document.getElementById('config-container');
    container.appendChild(getTemplate('template-config-error'));
  }
}

function refreshConfigDisplay() {
  // Re-render without re-fetching from server
  renderConfigTable(currentConfig, window.allRooms || []);
}

function renderConfigTable(config, allRooms) {
  const container = document.getElementById('config-container');
  
  // Ensure all rooms have a config entry
  allRooms.forEach(roomName => {
    const exists = config.overrideRules.find(r => r.roomName === roomName);
    if (!exists) {
      config.overrideRules.push({
        roomName: roomName,
        allowOverride: false,
        timeWindows: []
      });
    }
  });
  
  // Build table structure
  const table = document.createElement('table');
  table.style.cssText = 'width: 100%; border-collapse: collapse;';
  
  // Create header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background: #f3f4f6;">
      <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Room</th>
      <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Block Overrides</th>
      <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Blocked Time Windows</th>
      <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; width: 80px;">Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  config.overrideRules.forEach((rule, ruleIdx) => {
    const row = createConfigTableRow(rule, ruleIdx);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.innerHTML = '';
  container.appendChild(table);
}

function createConfigTableRow(rule, ruleIdx) {
  const row = document.createElement('tr');
  row.style.borderBottom = '1px solid #e5e7eb';
  
  // Room name cell
  const nameCell = document.createElement('td');
  nameCell.style.cssText = 'padding: 12px; font-weight: 600;';
  nameCell.textContent = rule.roomName;
  row.appendChild(nameCell);
  
  // Block override checkbox cell
  const checkboxCell = document.createElement('td');
  checkboxCell.style.cssText = 'padding: 12px; text-align: center;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = rule.allowOverride;
  checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
  checkbox.title = rule.allowOverride 
    ? 'Blocking enabled: Add time windows to allow overrides during specific times, or leave empty to block 24/7' 
    : 'Blocking disabled: Overrides ALWAYS ALLOWED (time windows ignored)';
  checkbox.onchange = (e) => toggleRoomOverride(ruleIdx, e.target.checked);
  checkboxCell.appendChild(checkbox);
  row.appendChild(checkboxCell);
  
  // Time windows cell
  const windowsCell = document.createElement('td');
  windowsCell.style.padding = '12px';
  const windowsContainer = document.createElement('div');
  windowsContainer.id = `windows-${ruleIdx}`;
  
  if (rule.timeWindows.length === 0) {
    const emptyText = document.createElement('span');
    emptyText.style.color = '#9ca3af';
    emptyText.textContent = rule.allowOverride 
      ? 'No time windows (overrides blocked 24/7)' 
      : 'No blocked windows defined';
    windowsContainer.appendChild(emptyText);
  } else {
    rule.timeWindows.forEach((window, winIdx) => {
      const windowEl = createTimeWindowDisplay(window, ruleIdx, winIdx);
      windowsContainer.appendChild(windowEl);
    });
  }
  windowsCell.appendChild(windowsContainer);
  row.appendChild(windowsCell);
  
  // Actions cell
  const actionsCell = document.createElement('td');
  actionsCell.style.cssText = 'padding: 12px; text-align: center;';
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Window';
  addBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;';
  addBtn.title = 'Add a blocked time window (only active when Block Overrides is enabled)';
  addBtn.onclick = () => addTimeWindow(ruleIdx);
  actionsCell.appendChild(addBtn);
  row.appendChild(actionsCell);
  
  return row;
}

function createTimeWindowDisplay(window, ruleIdx, winIdx) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daysFull = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const selectedDays = window.days.map(d => d.toLowerCase());
  
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #667eea;';
  
  const flexContainer = document.createElement('div');
  flexContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const leftDiv = document.createElement('div');
  const timeRange = document.createElement('strong');
  timeRange.textContent = `${window.start} - ${window.end}`;
  leftDiv.appendChild(timeRange);
  
  const dayBadgesDiv = document.createElement('div');
  dayBadgesDiv.style.marginTop = '4px';
  days.forEach((day, idx) => {
    const isSelected = selectedDays.includes(daysFull[idx]);
    const badge = createDayBadge(day, isSelected);
    dayBadgesDiv.appendChild(badge);
  });
  leftDiv.appendChild(dayBadgesDiv);
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '✕';
  removeBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;';
  removeBtn.onclick = () => removeTimeWindow(ruleIdx, winIdx);
  
  flexContainer.appendChild(leftDiv);
  flexContainer.appendChild(removeBtn);
  container.appendChild(flexContainer);
  
  return container;
}

function toggleRoomOverride(ruleIdx, allowed) {
  currentConfig.overrideRules[ruleIdx].allowOverride = allowed;
  refreshConfigDisplay(); // Refresh to update button states and empty messages
}

function addTimeWindow(ruleIdx) {
  const roomName = currentConfig.overrideRules[ruleIdx].roomName;
  const isBlocking = currentConfig.overrideRules[ruleIdx].allowOverride;
  
  // Inform user if blocking is currently disabled
  let warningMsg = '';
  if (!isBlocking) {
    warningMsg = '⚠️ Note: "Block Overrides" is currently DISABLED for this room.\n' +
                 'The time window will be saved but will only take effect\n' +
                 'when you enable "Block Overrides".\n\n';
  }
  
  // Simple form with better instructions
  const start = prompt(
    warningMsg +
    `Add Blocked Time Window for ${roomName}\n\n` +
    'Time windows define when overrides are BLOCKED (NOT allowed).\n' +
    'Outside blocked windows, overrides are ALLOWED.\n' +
    'If no windows are specified, overrides are BLOCKED 24/7.\n\n' +
    'Enter START time (24-hour format HH:MM):\n' +
    'Examples: 09:00, 17:00, 23:00',
    '09:00'
  );
  
  if (!start) return;
  
  const end = prompt(
    `Add Blocked Time Window for ${roomName}\n` +
    `Start: ${start}\n\n` +
    'Enter END time (24-hour format HH:MM):\n' +
    'Examples: 18:00, 23:00, 06:00\n\n' +
    '💡 Tip: For overnight periods like 23:00-06:00,\n' +
    '   the end time can be less than start time.',
    '17:00'
  );
  
  if (!end) return;
  
  const daysInput = prompt(
    `Add Blocked Time Window for ${roomName}\n` +
    `Blocked Time: ${start} - ${end}\n\n` +
    'Select days (enter numbers separated by commas):\n' +
    '1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday,\n' +
    '5=Friday, 6=Saturday, 7=Sunday\n\n' +
    'Examples:\n' +
    '  1,2,3,4,5 = Weekdays only\n' +
    '  6,7 = Weekends only\n' +
    '  (leave empty for all days)',
    ''
  );
  
  let selectedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  if (daysInput && daysInput.trim()) {
    const dayMap = {
      '1': 'monday', '2': 'tuesday', '3': 'wednesday', '4': 'thursday',
      '5': 'friday', '6': 'saturday', '7': 'sunday'
    };
    selectedDays = daysInput.split(',')
      .map(d => dayMap[d.trim()])
      .filter(d => d !== undefined);
    
    if (selectedDays.length === 0) {
      alert('❌ Invalid day selection. Please try again.');
      return;
    }
  }
  
  currentConfig.overrideRules[ruleIdx].timeWindows.push({
    start: start,
    end: end,
    days: selectedDays
  });
  
  refreshConfigDisplay(); // Refresh display without re-fetching
}

function removeTimeWindow(ruleIdx, winIdx) {
  if (confirm('Remove this time window?')) {
    currentConfig.overrideRules[ruleIdx].timeWindows.splice(winIdx, 1);
    refreshConfigDisplay(); // Refresh display without re-fetching
  }
}

async function saveConfig() {
  try {
    await saveConfiguration(currentConfig);
    alert('✅ Configuration saved successfully!');
  } catch (error) {
    alert('❌ Error saving configuration: ' + error.message);
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize page when ready
initializeEvohomePage('status', () => {
  fetchStatus();
  loadConfig(); // Load configuration on page load
  setInterval(fetchStatus, 10000);
});
