/**
 * EvoHome System Status JavaScript
 * 
 * Monitors and displays:
 * - Polling operations status
 * - API statistics (V1 and V2)
 * - Request counts and timestamps
 */

/**
 * Formats a date as a readable string or "Never" if null
 * @param {string|null} date - ISO date string
 * @returns {string} Formatted date or "Never"
 */
function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

/**
 * Updates the API statistics display
 * @param {Object} apiStats - API statistics object with v1 and v2 data
 */
function updateApiStats(apiStats) {
  if (!apiStats) return;
  
  /**
   * Helper to update a stat counter with proper color class
   * @param {string} id - Element ID
   * @param {number} value - Counter value
   * @param {string} colorClass - Color class (success, fail, total)
   */
  function updateCounter(id, value, colorClass) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const numValue = value || 0;
    element.textContent = numValue;
    
    // Remove all color classes
    element.classList.remove('success', 'fail', 'total', 'zero');
    
    // Add appropriate class
    if (numValue === 0) {
      element.classList.add('zero');
    } else {
      element.classList.add(colorClass);
    }
  }
  
  /**
   * Helper to format timestamp display
   * @param {string|null} successTime - Last success timestamp
   * @param {string|null} failTime - Last fail timestamp
   * @returns {string} Formatted timestamp HTML
   */
  function formatTimestamps(successTime, failTime) {
    const success = successTime ? formatDate(successTime) : 'Never';
    const fail = failTime ? formatDate(failTime) : 'Never';
    return `<div class="stat-timestamp-row"><span class="stat-timestamp-label">Last Success</span><span class="stat-timestamp-colon">:</span><span class="stat-timestamp-value">${success}</span></div><div class="stat-timestamp-row"><span class="stat-timestamp-label">Last Failed</span><span class="stat-timestamp-colon">:</span><span class="stat-timestamp-value">${fail}</span></div>`;
  }
  
  // V2 API Statistics
  if (apiStats.v2) {
    // Auth stats
    updateCounter('v2-auth-success', apiStats.v2.auth.totalSuccess, 'success');
    updateCounter('v2-auth-failed', apiStats.v2.auth.totalFailed, 'fail');
    updateCounter('v2-auth-total', apiStats.v2.auth.totalRequests, 'total');
    
    // GET stats
    updateCounter('v2-get-success', apiStats.v2.get.success, 'success');
    updateCounter('v2-get-failed', apiStats.v2.get.failed, 'fail');
    updateCounter('v2-get-total', (apiStats.v2.get.success || 0) + (apiStats.v2.get.failed || 0), 'total');
    
    // PUT stats
    updateCounter('v2-put-success', apiStats.v2.put.success, 'success');
    updateCounter('v2-put-failed', apiStats.v2.put.failed, 'fail');
    updateCounter('v2-put-total', (apiStats.v2.put.success || 0) + (apiStats.v2.put.failed || 0), 'total');
    
    // Timestamps
    const v2AuthLast = document.getElementById('v2-auth-last');
    if (v2AuthLast) {
      v2AuthLast.innerHTML = formatTimestamps(apiStats.v2.auth.lastAuthTime, apiStats.v2.auth.lastFailedTime);
    }
    
    const v2GetLast = document.getElementById('v2-get-last');
    if (v2GetLast) {
      v2GetLast.innerHTML = formatTimestamps(apiStats.v2.get.lastSuccessTime, apiStats.v2.get.lastFailedTime);
    }
    
    const v2PutLast = document.getElementById('v2-put-last');
    if (v2PutLast) {
      v2PutLast.innerHTML = formatTimestamps(apiStats.v2.put.lastSuccessTime, apiStats.v2.put.lastFailedTime);
    }
  }
  
  // V1 API Statistics
  if (apiStats.v1) {
    // Auth stats
    updateCounter('v1-auth-success', apiStats.v1.auth.totalSuccess, 'success');
    updateCounter('v1-auth-failed', apiStats.v1.auth.totalFailed, 'fail');
    updateCounter('v1-auth-total', apiStats.v1.auth.totalRequests, 'total');
    
    // GET stats
    updateCounter('v1-get-success', apiStats.v1.get.success, 'success');
    updateCounter('v1-get-failed', apiStats.v1.get.failed, 'fail');
    updateCounter('v1-get-total', (apiStats.v1.get.success || 0) + (apiStats.v1.get.failed || 0), 'total');
    
    // PUT stats
    updateCounter('v1-put-success', apiStats.v1.put.success, 'success');
    updateCounter('v1-put-failed', apiStats.v1.put.failed, 'fail');
    updateCounter('v1-put-total', (apiStats.v1.put.success || 0) + (apiStats.v1.put.failed || 0), 'total');
    
    // Timestamps
    const v1AuthLast = document.getElementById('v1-auth-last');
    if (v1AuthLast) {
      v1AuthLast.innerHTML = formatTimestamps(apiStats.v1.auth.lastAuthTime, apiStats.v1.auth.lastFailedTime);
    }
    
    const v1GetLast = document.getElementById('v1-get-last');
    if (v1GetLast) {
      v1GetLast.innerHTML = formatTimestamps(apiStats.v1.get.lastSuccessTime, apiStats.v1.get.lastFailedTime);
    }
    
    const v1PutLast = document.getElementById('v1-put-last');
    if (v1PutLast) {
      v1PutLast.innerHTML = formatTimestamps(apiStats.v1.put.lastSuccessTime, apiStats.v1.put.lastFailedTime);
    }
  }
}

/**
 * Updates the status table with latest polling information
 */
async function updateStatus() {
  try {
    const response = await fetch('/plugin/evohome/api/status');
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    
    const responseData = await response.json();
    const status = responseData.pollingStatus;
    
    // Update API statistics
    updateApiStats(responseData.apiStats);
    
    // Update each row
    ['zoneStatus', 'overrideReset', 'scheduleRefresh'].forEach(operationType => {
      const operationData = status[operationType];
      const row = document.getElementById(`row-${operationType}`);
      
      if (!row || !operationData) return;
      
      // Update interval
      const intervalCell = row.querySelector('.interval');
      intervalCell.textContent = `${operationData.intervalMinutes} min`;
      
      // Update total runs
      const totalRunsCell = row.querySelector('.total-runs');
      totalRunsCell.textContent = operationData.totalRuns || 0;
      
      // Update last poll
      const lastPollCell = row.querySelector('.last-poll');
      lastPollCell.textContent = formatTime(operationData.lastRun);
      
      // Update next poll
      const nextPollCell = row.querySelector('.next-poll');
      nextPollCell.textContent = formatTime(operationData.nextRun);
      
      // Update countdown
      const countdownCell = row.querySelector('.countdown');
      const countdownText = formatCountdown(operationData.nextRun);
      countdownCell.textContent = countdownText;
      
      // Highlight if countdown is less than 30 seconds
      if (operationData.nextRun) {
        const diffMs = new Date(operationData.nextRun) - new Date();
        if (diffMs > 0 && diffMs < 30000) {
          countdownCell.classList.add('soon');
        } else {
          countdownCell.classList.remove('soon');
        }
      }
      
      // Update status badge
      const statusCell = row.querySelector('.status');
      const badge = statusCell.querySelector('.status-badge');
      
      // Format status text with detail if available
      let statusText = operationData.status;
      if (operationData.status === 'Failed' && operationData.statusDetail) {
        // Extract HTTP status code if present
        const httpMatch = operationData.statusDetail.match(/(\d{3})/);
        if (httpMatch) {
          statusText = `Failed (${httpMatch[1]})`;
        } else {
          statusText = 'Failed';
        }
      }
      
      badge.textContent = statusText;
      badge.className = 'status-badge';
      
      if (operationData.status === 'OK') {
        badge.classList.add('ok');
      } else if (operationData.status === 'Failed') {
        badge.classList.add('failed');
      } else if (operationData.status === 'Running') {
        badge.classList.add('running');
      } else if (operationData.status === 'Pending') {
        badge.classList.add('pending');
      } else if (operationData.status === 'NOT RUN') {
        badge.classList.add('not-run');
      }
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize page when ready (no templates needed, but wait for DOM)
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  setInterval(updateStatus, 1000);
});
