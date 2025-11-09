/**
 * EvoHome Dashboard View JavaScript
 * 
 * Uses the core DOMDiffer framework utility for efficient updates.
 * 
 * Key features:
 * - Template-based card rendering with DOM caching
 * - Differential updates - only modifies changed data
 * - Framework-level DOMDiffer for collection management
 * - Plugin-specific logic only, no DOM diffing code
 */

/**
 * Cached dashboard data from last successful fetch
 */
let cachedData = null;

/**
 * Timestamp of last successful API fetch
 */
let lastSuccessfulFetch = null;

/**
 * DOM Differ instance for managing room cards
 */
let roomsDiffer = null;

/**
 * Fetches and displays dashboard data
 */
async function fetchDashboardData() {
  try {
    const data = await fetchEvohomeStatus();
    
    if (!data.lastResult && data.stats.totalRuns === 0) {
      updateUnconfiguredDisplay();
      return;
    }
    
    cachedData = data;
    lastSuccessfulFetch = Date.now();
    
    updateRoomsDisplayOptimized(data, false);
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    
    if (cachedData) {
      console.warn('Using cached data due to fetch error');
      updateRoomsDisplayOptimized(cachedData, true);
    }
  }
}

/**
 * Updates dashboard using DOMDiffer framework utility
 * This is the plugin-specific implementation of the update logic
 */
function updateRoomsDisplayOptimized(data, usingCache = false) {
  const { lastResult, stats, isRunning } = data;
  
  // Update status badge (simple, always update)
  updateStatusBadge(usingCache, isRunning, lastResult);
  
  // Update last update time
  updateLastUpdateTime(lastResult);
  
  const grid = document.getElementById('rooms-grid');
  const loadingMessage = document.getElementById('loading-message');
  
  // Initialize differ if needed
  if (!roomsDiffer) {
    roomsDiffer = new DOMDiffer(grid, {
      idAttribute: 'data-device-id',
      shouldUpdate: hasDeviceChanged
    });
  }
  
  if (!lastResult || !lastResult.devices || lastResult.devices.length === 0) {
    roomsDiffer.clear();
    // Remove loading message if it exists
    if (loadingMessage) loadingMessage.remove();
    // Show no rooms message
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #9ca3af; grid-column: 1/-1;">No rooms found</div>';
    return;
  }
  
  // Remove loading message once we have data to display
  if (loadingMessage) {
    loadingMessage.remove();
  }
  
  // Use framework DOMDiffer to manage the collection
  roomsDiffer.updateCollection(
    lastResult.devices,
    createRoomCard,      // Function to create new card
    updateRoomCard,      // Function to update existing card
    device => device.deviceID  // Function to get unique ID
  );
}

/**
 * Determines if a device's data has changed and needs updating
 * Compares key properties that would affect display
 */
function hasDeviceChanged(prevDevice, currentDevice) {
  if (!prevDevice) return true;
  
  // Only compare the specific fields we display
  return prevDevice.curTemp !== currentDevice.curTemp ||
    prevDevice.setTemp !== currentDevice.setTemp ||
    prevDevice.status !== currentDevice.status ||
    prevDevice.isFailed !== currentDevice.isFailed ||
    prevDevice.isOverrideAllowed !== currentDevice.isOverrideAllowed;
}

/**
 * Creates a new room card from the HTML template
 * This only happens once per zone - structure is never recreated
 */
function createRoomCard(device) {
  // Clone the template using template helper
  const card = getTemplate('template-room-card').querySelector('.room-card');
  
  // Set the device ID attribute for tracking
  card.setAttribute('data-device-id', device.deviceID);
  
  // Set static content that never changes
  card.querySelector('.room-name-text').textContent = device.name;
  
  // Set up event listener on the boost button
  const boostBtn = card.querySelector('.boost-btn');
  boostBtn.addEventListener('click', () => {
    const currentDevice = getDeviceById(device.deviceID);
    if (currentDevice) {
      boostDevice(
        currentDevice.deviceID,
        currentDevice.thermostatModelType,
        currentDevice.curTemp,
        currentDevice.setTemp,
        currentDevice.name,
        currentDevice.status
      );
    }
  });
  
  // Initial population with current data
  updateRoomCard(card, device, null);
  
  return card;
}

/**
 * Helper to get current device data by ID
 */
function getDeviceById(deviceId) {
  if (!cachedData || !cachedData.lastResult || !cachedData.lastResult.devices) {
    return null;
  }
  return cachedData.lastResult.devices.find(d => d.deviceID === deviceId);
}

/**
 * Updates an existing room card with new data
 * ONLY updates text content and attributes - NEVER recreates DOM elements
 * Caches DOM references to avoid repeated querySelector calls
 */
function updateRoomCard(card, device, prevDevice) {
  const isDHW = device.name === 'Domestic Hot Water';
  
  // Cache DOM elements on first access
  if (!card._domCache) {
    card._domCache = {
      statusIcon: card.querySelector('.room-status-icon'),
      roomStatus: card.querySelector('.room-status'),
      header: card.querySelector('.room-card-header'),
      tempWholeEl: card.querySelector('.current-temp-value'),
      tempDecimalEl: card.querySelector('.current-temp-decimal'),
      tempUnitEl: card.querySelector('.current-temp-unit'),
      tempContainer: card.querySelector('.temp-display-container'),
      targetTempNumber: card.querySelector('.target-temp-number'),
      targetTempUnit: card.querySelector('.target-temp-value .target-temp-unit'),
      boostBtn: card.querySelector('.boost-btn'),
      boostLabel: card.querySelector('.boost-label')
    };
  }
  const cache = card._domCache;
  
  // 1. Update status icon (just text content)
  let newStatusIcon = isDHW ? '💧' : '🟢';
  
  if (device.isFailed) {
    newStatusIcon = '🔴';
  } else if (!['Scheduled', 'N/A', 'DHWOn', 'DHWOff'].includes(device.status)) {
    newStatusIcon = '🟡';
  }
  
  if (cache.statusIcon.textContent !== newStatusIcon) {
    cache.statusIcon.textContent = newStatusIcon;
  }
  
  // 2. Update room status badge
  let newStatusClass = 'room-status status-scheduled';
  let newStatusText = 'Scheduled';
  
  if (device.isFailed) {
    newStatusClass = 'room-status status-failed';
    newStatusText = 'Sensor Failed';
  } else if (isDHW) {
    // DHW-specific status logic
    if (device.status === 'Temporary') {
      newStatusClass = 'room-status status-override';
      newStatusText = 'Temporary Override';
    } else if (device.status === 'DHWOn' || device.status === 'DHWOff') {
      newStatusClass = 'room-status status-scheduled';
      newStatusText = 'Scheduled';
    } else {
      newStatusClass = 'room-status status-scheduled';
      newStatusText = device.status;
    }
  } else if (!['Scheduled', 'N/A'].includes(device.status)) {
    // Temperature zone with override
    newStatusClass = 'room-status status-override';
    newStatusText = device.status;
  }
  
  if (cache.roomStatus.className !== newStatusClass) {
    cache.roomStatus.className = newStatusClass;
  }
  if (cache.roomStatus.textContent !== newStatusText) {
    cache.roomStatus.textContent = newStatusText;
  }
  
  // 3. Update override indicator (show padlock if blocking is active, hide otherwise)
  let overrideIndicator = cache.header.querySelector('.override-indicator');
  
  // Show padlock only if blocking is active (not allowed) and not DHW
  if (device.isOverrideAllowed === false && !device.isFailed && device.name !== 'Domestic Hot Water') {
    if (!overrideIndicator) {
      overrideIndicator = document.createElement('span');
      overrideIndicator.className = 'override-indicator';
      overrideIndicator.textContent = '🔒';
      overrideIndicator.title = 'Override blocking is active for this zone';
      overrideIndicator.style.cssText = 'margin-left: 6px; font-size: 16px;';
      cache.header.appendChild(overrideIndicator);
    }
  } else {
    if (overrideIndicator) {
      overrideIndicator.remove();
    }
  }
  
  // 4. Update DHW flame indicator (show/hide based on actual state)
  let dhwFlame = card.querySelector('.dhw-flame-indicator');
  if (isDHW && device.dhwState === 'DHWOn') {
    if (!dhwFlame) {
      dhwFlame = document.createElement('div');
      dhwFlame.className = 'dhw-flame-indicator';
      dhwFlame.style.cssText = 'position: absolute; top: 12px; right: 12px; font-size: 32px; opacity: 0.8;';
      dhwFlame.textContent = '🔥';
      card.insertBefore(dhwFlame, card.firstChild);
    }
  } else {
    if (dhwFlame) {
      dhwFlame.remove();
    }
  }
  
  // 5. Update temperature display (all zones including DHW)
  if (!device.isFailed && device.curTemp !== null) {
    const tempValue = device.curTemp.toString();
    const [tempWhole, tempDecimal] = tempValue.split('.');
    const currentTempDecimal = tempDecimal ? `.${tempDecimal}` : '';
    
    // Reset any custom styling (in case it was sensor failed before)
    if (cache.tempWholeEl.style.fontSize || cache.tempWholeEl.style.color) {
      cache.tempWholeEl.style.fontSize = '';
      cache.tempWholeEl.style.color = '';
      cache.tempWholeEl.style.fontWeight = '';
    }
    
    if (cache.tempWholeEl.textContent !== tempWhole) {
      cache.tempWholeEl.textContent = tempWhole;
    }
    if (cache.tempDecimalEl.textContent !== currentTempDecimal) {
      cache.tempDecimalEl.textContent = currentTempDecimal;
    }
    
    // Ensure decimal and unit are visible
    if (cache.tempDecimalEl.style.display === 'none') {
      cache.tempDecimalEl.style.display = '';
    }
    if (cache.tempUnitEl.style.display === 'none') {
      cache.tempUnitEl.style.display = '';
    }
    
    // Update temperature indicator (heating/cooling/at-target) - only for non-DHW zones
    if (!isDHW) {
      let tempIndicator = cache.tempContainer.querySelector('.temp-indicator');
      
      let newIndicatorClass = '';
      const current = device.curTemp;
      const target = device.setTemp;
      
      if (target !== null) {
        if (current < target - 0.5) {
          newIndicatorClass = 'temp-indicator heating';
        } else if (current > target + 0.5) {
          newIndicatorClass = 'temp-indicator cooling';
        } else {
          newIndicatorClass = 'temp-indicator at-target';
        }
      }
      
      if (newIndicatorClass) {
        if (!tempIndicator) {
          tempIndicator = document.createElement('div');
          cache.tempContainer.insertBefore(tempIndicator, cache.tempContainer.firstChild);
        }
        if (tempIndicator.className !== newIndicatorClass) {
          tempIndicator.className = newIndicatorClass;
        }
      } else if (tempIndicator) {
        tempIndicator.remove();
      }
    } else {
      // DHW - remove temperature indicator
      const tempIndicator = cache.tempContainer.querySelector('.temp-indicator');
      if (tempIndicator) {
        tempIndicator.remove();
      }
    }
  } else if (device.isFailed) {
    const tempValue = device.curTemp.toString();
    const [tempWhole, tempDecimal] = tempValue.split('.');
    const currentTempDecimal = tempDecimal ? `.${tempDecimal}` : '';
    
    if (cache.tempWholeEl.textContent !== tempWhole) {
      cache.tempWholeEl.textContent = tempWhole;
    }
    if (cache.tempDecimalEl.textContent !== currentTempDecimal) {
      cache.tempDecimalEl.textContent = currentTempDecimal;
    }
    
    // Update temperature indicator (heating/cooling/at-target)
    let tempIndicator = cache.tempContainer.querySelector('.temp-indicator');
    
    let newIndicatorClass = '';
    const current = device.curTemp;
    const target = device.setTemp;
    
    if (target !== null) {
      if (current < target - 0.5) {
        newIndicatorClass = 'temp-indicator heating';
      } else if (current > target + 0.5) {
        newIndicatorClass = 'temp-indicator cooling';
      } else {
        newIndicatorClass = 'temp-indicator at-target';
      }
    }
    
    if (newIndicatorClass) {
      if (!tempIndicator) {
        tempIndicator = document.createElement('div');
        cache.tempContainer.insertBefore(tempIndicator, cache.tempContainer.firstChild);
      }
      if (tempIndicator.className !== newIndicatorClass) {
        tempIndicator.className = newIndicatorClass;
      }
    } else if (tempIndicator) {
      tempIndicator.remove();
    }
  } else if (device.isFailed) {
    // Show sensor failed message
    if (cache.tempWholeEl.textContent !== 'SENSOR FAILED') {
      cache.tempWholeEl.textContent = 'SENSOR FAILED';
      cache.tempWholeEl.style.fontSize = '32px';
      cache.tempWholeEl.style.color = '#ef4444';
      cache.tempWholeEl.style.fontWeight = '600';
    }
    
    // Hide decimal and unit
    cache.tempDecimalEl.textContent = '';
    cache.tempUnitEl.style.display = 'none';
  }
  
  // 6. Update target temperature (just the number)
  const newTargetTemp = device.setTemp !== null ? device.setTemp.toString() : 'N/A';
  if (cache.targetTempNumber.textContent !== newTargetTemp) {
    cache.targetTempNumber.textContent = newTargetTemp;
  }
  
  // Hide/show unit based on whether we have a value
  cache.targetTempUnit.style.display = device.setTemp !== null ? '' : 'none';
  
  // 7. Update boost button
  const boostDisabled = shouldDisableBoost(device.thermostatModelType, device.status, device.isOverrideAllowed);
  const newBoostLabel = getBoostButtonLabel(device.thermostatModelType, device.status);
  const newBoostTooltip = getBoostTooltip(device.thermostatModelType, device.status, device.isOverrideAllowed);
  
  if (cache.boostLabel.textContent !== newBoostLabel) {
    cache.boostLabel.textContent = newBoostLabel;
  }
  if (cache.boostBtn.title !== newBoostTooltip) {
    cache.boostBtn.title = newBoostTooltip;
  }
  if (cache.boostBtn.disabled !== boostDisabled) {
    cache.boostBtn.disabled = boostDisabled;
  }
}

/**
 * Helper functions for boost button state
 */
function shouldDisableBoost(deviceType, status, isOverrideAllowed) {
  if (deviceType === 'DOMESTIC_HOT_WATER') {
    return false; // DHW can always boost or cancel
  }
  // Disable boost if overrides are blocked for this zone
  if (isOverrideAllowed === false) {
    return true;
  }
  return false;
}

function getBoostButtonLabel(deviceType, status) {
  if (deviceType === 'DOMESTIC_HOT_WATER') {
    // Show "Cancel Override" for temporary override, otherwise "Boost"
    return status === 'Temporary' ? 'Cancel Override' : 'Boost';
  }
  if (status === 'Temporary' || status === 'Hold') {
    return 'Cancel Override';
  }
  return 'Boost';
}

function getBoostTooltip(deviceType, status, isOverrideAllowed) {
  if (deviceType === 'DOMESTIC_HOT_WATER') {
    // Show appropriate tooltip for DHW based on override status
    return status === 'Temporary' ? 'Reset DHW to schedule' : 'Turn ON for 1 hour';
  }
  // Show blocked message if overrides are not allowed
  if (isOverrideAllowed === false) {
    return 'Overrides blocked during this time window';
  }
  if (status === 'Temporary' || status === 'Hold') {
    return 'Cancel override and return to schedule';
  }
  return 'Increase temperature by 1.5°C for 1 hour';
}

/**
 * Updates status badge without recreating element
 */
function updateStatusBadge(usingCache, isRunning, lastResult) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;
  
  let className, textContent;
  
  if (usingCache) {
    className = 'status-badge status-error';
    textContent = '● Using Cached Data';
  } else if (isRunning) {
    className = 'status-badge status-checking';
    textContent = '● Checking...';
  } else if (lastResult && lastResult.success) {
    className = 'status-badge status-online';
    textContent = '● Online';
  } else if (lastResult && !lastResult.success) {
    className = 'status-badge status-error';
    textContent = '● Error';
  } else {
    className = 'status-badge status-offline';
    textContent = '● Offline';
  }
  
  if (badge.className !== className) badge.className = className;
  if (badge.textContent !== textContent) badge.textContent = textContent;
}

/**
 * Updates last update time
 */
function updateLastUpdateTime(lastResult) {
  const lastUpdate = document.getElementById('last-update');
  if (!lastUpdate || !lastResult) return;
  
  const date = new Date(lastResult.timestamp);
  const text = `Last updated: ${formatTime(date)}`;
  
  if (lastUpdate.textContent !== text) {
    lastUpdate.textContent = text;
  }
}

/**
 * Splits temperature into whole and decimal parts
 */
function splitTemperature(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return ['--', ''];
  }
  
  const tempStr = temp.toFixed(1);
  const [whole, decimal] = tempStr.split('.');
  return [whole, decimal ? `.${decimal}` : ''];
}

/**
 * Shows unconfigured state
 */
function updateUnconfiguredDisplay() {
  const grid = document.getElementById('rooms-grid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
      <div style="font-size: 64px; margin-bottom: 20px;">⚙️</div>
      <h2 style="color: #1f2937; margin-bottom: 12px;">EvoHome Not Configured</h2>
      <p style="color: #6b7280; margin-bottom: 24px; font-size: 16px;">
        Please configure your EvoHome credentials to start monitoring your heating system.
      </p>
      <a href="/plugin/evohome/settings" style="
        display: inline-block;
        background: #667eea;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        transition: background 0.2s;
      " onmouseover="this.style.background='#5568d3'" onmouseout="this.style.background='#667eea'">
        🔧 Go to Settings
      </a>
    </div>
  `;
}

/**
 * Manual refresh trigger
 */
async function refreshDashboard() {
  await fetchDashboardData();
}

/**
 * Boosts a device (temperature zone or DHW) or cancels an existing boost
 * @param {number} deviceId - Device ID
 * @param {string} deviceType - Device type
 * @param {number} currentTemp - Current temperature (for zones)
 * @param {number} setTemp - Set temperature (for zones)
 * @param {string} deviceName - Device name for display
 * @param {string} status - Current status
 */
async function boostDevice(deviceId, deviceType, currentTemp, setTemp, deviceName, status) {
  const tile = document.querySelector(`[data-device-id="${deviceId}"]`);
  
  if (tile) {
    showTileLoading(tile, true);
  }
  
  try {
    if (deviceType === 'DOMESTIC_HOT_WATER') {
      // DHW can be boosted (turned ON) or canceled (reset to schedule)
      // Check if there's an active override (either DHWOn or Temporary)
      const hasOverride = status === 'DHWOn' || status === 'Temporary';
      
      if (hasOverride) {
        // Cancel DHW override
        const result = await cancelDHWBoost(deviceId);
        
        if (result.success) {
          showToast(`${deviceName} reset to schedule`, 'success');
          setTimeout(() => fetchDashboardData(), 1000);
        } else {
          showToast(`Failed to cancel ${deviceName}: ${result.error}`, 'error');
        }
      } else {
        // Boost DHW (turn ON for 1 hour)
        const result = await boostDHW(deviceId, 'On', 60);
        
        if (result.success) {
          showToast(`${deviceName} turned ON for 1 hour`, 'success');
          setTimeout(() => fetchDashboardData(), 1000);
        } else {
          showToast(`Failed to boost ${deviceName}: ${result.error}`, 'error');
        }
      }
    } else {
      const isBoosted = status === 'Temporary' || status === 'Hold';
      
      if (isBoosted) {
        const result = await cancelZoneBoost(deviceId);
        
        if (result.success) {
          showToast(`${deviceName} override canceled`, 'success');
          setTimeout(() => fetchDashboardData(), 1000);
        } else {
          showToast(`Failed to cancel override for ${deviceName}: ${result.error || 'Unknown error'}`, 'error');
        }
      } else {
        const baseTemp = setTemp !== null ? setTemp : currentTemp;
        const result = await boostZone(deviceId, baseTemp);
        
        if (result.success) {
          showToast(`${deviceName} boosted`, 'success');
          setTimeout(() => fetchDashboardData(), 1000);
        } else {
          showToast(`Failed to boost ${deviceName}: ${result.error || 'Unknown error'}`, 'error');
        }
      }
    }
  } catch (error) {
    showToast(`Failed to update ${deviceName}: ${error.message}`, 'error');
  } finally {
    if (tile) {
      showTileLoading(tile, false);
    }
  }
}

/**
 * Shows or hides loading overlay on a tile
 * @param {HTMLElement} tile - The tile element
 * @param {boolean} show - Whether to show or hide the overlay
 */
function showTileLoading(tile, show) {
  let overlay = tile.querySelector('.tile-loading-overlay');
  
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'tile-loading-overlay';
      overlay.innerHTML = '<div class="spinner"></div>';
      tile.appendChild(overlay);
    }
  } else {
    if (overlay) {
      overlay.remove();
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize page when ready
initializeEvohomePage('dashboard', () => {
  fetchDashboardData();
  setInterval(fetchDashboardData, 1000);
});
