/**
 * Global System Logs JavaScript
 * 
 * Client-side logic for the activity logs page with:
 * - Real-time log fetching (10-second intervals)
 * - Dynamic source filter generation (server, plugins)
 * - Bi-dimensional filtering (level + source)
 * - Syntax highlighting for log components
 * - Full timestamp display
 * 
 * Log Format Parsing:
 * HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
 * 
 * Features:
 * - Auto-discovers sources from log content
 * - Checkboxes to enable/disable specific sources
 * - Radio buttons for log level filtering (All, Debug, Info, Warning, Error)
 * - Color-coded display (timestamps gray, sources purple, levels colored)
 */

/**
 * Cached log content from last fetch
 * @type {string}
 */
let logsCache = '';

/**
 * Set of discovered log sources (server, evohome, etc.)
 * @type {Set<string>}
 */
let sourceFilters = new Set();

/**
 * Fetches logs from the API and updates the display
 * 
 * Makes a GET request to /api/logs, updates source filters,
 * and displays filtered log entries.
 * 
 * @async
 */
async function fetchLogs() {
  try {
    const response = await fetch('/api/logs');
    const logs = await response.text();
    logsCache = logs;
    updateSourceFilters(logs);
    displayLogs(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    document.getElementById('logs-content').textContent = 'Failed to load logs';
  }
}

/**
 * Discovers and updates source filters from log content
 * 
 * Parses log lines to extract unique [source] values.
 * Only re-renders checkboxes if the source list has changed,
 * preventing unnecessary DOM updates.
 * 
 * Log Format: HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
 * 
 * @param {string} logs - Raw log file content
 */
function updateSourceFilters(logs) {
  const lines = logs.split('\n').filter(line => line.trim());
  const sources = new Set();
  
  // Extract unique sources from logs
  // Format: HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
  lines.forEach(line => {
    const match = line.match(/\d{2}:\d{2}:\d{2}\s+\d{2}\/\d{2}\/\d{4}\s+\[([^\]]+)\]/);
    if (match) {
      sources.add(match[1]);
    }
  });
  
  // Only update if sources have changed
  const sourcesArray = Array.from(sources).sort();
  const currentSources = Array.from(sourceFilters).sort();
  
  if (JSON.stringify(sourcesArray) !== JSON.stringify(currentSources)) {
    sourceFilters = sources;
    renderSourceFilters();
  }
}

/**
 * Renders source filter checkboxes
 * 
 * Creates checkboxes for each discovered source (server, evohome, etc.).
 * All checkboxes are checked by default.
 * Attaches change event listeners to trigger log filtering.
 */
function renderSourceFilters() {
  const container = document.getElementById('source-filters');
  if (!container) return;
  
  const sourcesArray = Array.from(sourceFilters).sort();
  
  container.innerHTML = sourcesArray.map(source => `
    <label>
      <input type="checkbox" class="filter-source" data-source="${source}" checked> ${source}
    </label>
  `).join('');
  
  // Add event listeners to new checkboxes
  container.querySelectorAll('.filter-source').forEach(checkbox => {
    checkbox.addEventListener('change', () => displayLogs(logsCache));
  });
}

/**
 * Filters and displays log entries based on selected criteria
 * 
 * Applies two-dimensional filtering:
 * 1. Log Level: Based on selected radio button (All/Debug/Info/Warning/Error)
 * 2. Source: Based on checked source checkboxes
 * 
 * Parses log format: HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
 * 
 * Renders with syntax highlighting:
 * - Timestamp: Gray (#888)
 * - Source: Purple (#8b5cf6)
 * - Level: Color-coded (cyan/green/yellow/red)
 * - Message: White
 * 
 * @param {string} logs - Raw log file content to filter and display
 */
function displayLogs(logs) {
  const content = document.getElementById('logs-content');
  
  // Defensive check: ensure content element exists
  if (!content) {
    console.error('Log content element not found');
    return;
  }
  
  if (!logs || logs === 'No logs available') {
    content.innerHTML = '<span style="color: #9ca3af;">No logs available yet. Logs will appear after the first check runs.</span>';
    return;
  }
  
  // Parse logs and apply filters
  const lines = logs.split('\n').filter(line => line.trim());
  const levelFilters = {
    debug: document.getElementById('filter-debug')?.checked ?? true,
    info: document.getElementById('filter-info')?.checked ?? true,
    warning: document.getElementById('filter-warning')?.checked ?? true,
    error: document.getElementById('filter-error')?.checked ?? true,
  };
  
  // Get active source filters
  const activeSourceFilters = new Set();
  document.querySelectorAll('.filter-source:checked').forEach(checkbox => {
    activeSourceFilters.add(checkbox.dataset.source);
  });
  
  const filteredLines = lines.filter(line => {
    // Filter by level
    if (line.includes('[DEBUG]') && !levelFilters.debug) return false;
    if (line.includes('[INFO]') && !levelFilters.info) return false;
    if (line.includes('[WARNING]') && !levelFilters.warning) return false;
    if (line.includes('[ERROR]') && !levelFilters.error) return false;
    
    // Filter by source
    if (activeSourceFilters.size > 0) {
      const sourceMatch = line.match(/\d{2}:\d{2}:\d{2}\s+\d{2}\/\d{2}\/\d{4}\s+\[([^\]]+)\]/);
      if (sourceMatch && !activeSourceFilters.has(sourceMatch[1])) {
        return false;
      }
    }
    
    return true;
  });
  
  // Format logs with colors
  // Format: HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
  const formattedLogs = filteredLines.map(line => {
    let className = 'log-info';
    
    if (line.includes('[DEBUG]')) {
      className = 'log-debug';
    } else if (line.includes('[WARNING]')) {
      className = 'log-warning';
    } else if (line.includes('[ERROR]')) {
      className = 'log-error';
    }
    
    // Parse the full log format with timestamp, source, level, and message
    const match = line.match(/(\d{2}:\d{2}:\d{2}\s+\d{2}\/\d{2}\/\d{4})\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)/);
    if (match) {
      const [, timestamp, source, level, message] = match;
      return `<div class="log-entry ${className}"><span class="log-timestamp">${timestamp}</span> <span class="log-source">[${source}]</span> <strong>[${level}]</strong> ${message}</div>`;
    }
    
    return `<div class="log-entry ${className}">${line}</div>`;
  }).join('');
  
  content.innerHTML = formattedLogs || '<span style="color: #9ca3af;">No logs match the current filters</span>';
  
  // Auto-scroll to bottom to show most recent logs
  if (content.parentElement) {
    content.parentElement.scrollTop = content.parentElement.scrollHeight;
  }
}

/**
 * Manually triggers a log refresh
 * 
 * Called by refresh button in UI.
 */
function refreshLogs() {
  fetchLogs();
}

/**
 * Clears the log display (visual only, doesn't delete files)
 * 
 * Called by clear button in UI.
 */
function clearLogs() {
  document.getElementById('logs-content').innerHTML = '<span style="color: #9ca3af;">Display cleared. Click Refresh to reload logs.</span>';
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Attaches filter event listeners on page load
 * 
 * Sets up change handlers for level filter radio buttons.
 * Source filter checkboxes are attached dynamically in renderSourceFilters().
 */
document.addEventListener('DOMContentLoaded', () => {
  ['filter-info', 'filter-debug', 'filter-warning', 'filter-error'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', () => displayLogs(logsCache));
    }
  });
});

// ============================================================================
// Initialization
// ============================================================================

/**
 * Auto-refresh polling interval
 * 
 * Fetches logs every 10 seconds to show near-realtime activity.
 */
setInterval(fetchLogs, 10000);

/** Perform initial load on page ready */
fetchLogs();
