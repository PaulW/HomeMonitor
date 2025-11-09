/**
 * Centralized Logging System for Home Monitor
 * 
 * Provides global logging functionality with:
 * - Timestamp formatting (HH:mm:ss DD/MM/YYYY)
 * - Source identification (server, plugins)
 * - Log level categorization (DEBUG, INFO, WARNING, ERROR)
 * - Daily log file rotation
 * - Color-coded console output
 * - File-based persistence in /logs directory
 * 
 * Log Format: HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
 * 
 * @module logger
 */

import { appendFile, readdir, readFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Directory where log files are stored */
const LOGS_DIR = join(__dirname, '../logs');

/** Log severity levels */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

/** Source identifier for log entries (server or plugin name) */
export type LogSource = 'server' | 'evohome' | string;

/**
 * Writes a log entry to both the daily log file and console
 * 
 * Creates log entries in the format:
 * HH:mm:ss DD/MM/YYYY [source] [LEVEL] message
 * 
 * Log files are named: home-monitor-YYYY-MM-DD.log
 * Console output is color-coded by log level:
 * - DEBUG: Gray (detailed technical information)
 * - INFO: Cyan (general information)
 * - WARNING: Yellow (warning messages)
 * - ERROR: Red (error messages)
 * 
 * @param message - The log message to write
 * @param source - Source identifier (server, plugin name). Defaults to 'server'
 * @param level - Log severity level. Defaults to 'INFO'
 * 
 * @example
 * ```typescript
 * await writeLog('Server starting...', 'server', 'INFO');
 * await writeLog('GET /api/data', 'evohome', 'DEBUG');
 * await writeLog('Rate limit approaching', 'evohome', 'WARNING');
 * await writeLog('Connection failed', 'evohome', 'ERROR');
 * ```
 */
export async function writeLog(
  message: string, 
  source: LogSource = 'server',
  level: LogLevel = 'INFO'
): Promise<void> {
  const now = new Date();
  
  // Format: HH:mm:ss DD/MM/YYYY
  const time = now.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
  
  const date = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  const timestamp = `${time} ${date}`;
  const logEntry = `${timestamp} [${source}] [${level}] ${message}\n`;
  
  // Get current date for log file name (YYYY-MM-DD format)
  const fileDate = now.toISOString().split('T')[0];
  const logFile = join(LOGS_DIR, `home-monitor-${fileDate}.log`);
  
  try {
    await appendFile(logFile, logEntry);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
  
  // Also log to console with color coding
  const colors: Record<LogLevel, string> = {
    DEBUG: '\x1b[32m',   // Green
    INFO: '\x1b[36m',    // Cyan
    WARNING: '\x1b[33m', // Yellow
    ERROR: '\x1b[31m',   // Red
  };
  const reset = '\x1b[0m';
  console.log(`${colors[level]}${logEntry.trim()}${reset}`);
}

/**
 * Rotates log files by deleting old entries
 * 
 * Keeps only the most recent N days of logs to prevent unlimited disk usage.
 * Log files are sorted by filename (YYYY-MM-DD format) and oldest files
 * are deleted first.
 * 
 * @param daysToKeep - Number of days of logs to retain. Defaults to 7
 * 
 * @example
 * ```typescript
 * // Keep 7 days of logs (default)
 * await rotateLogs();
 * 
 * // Keep 30 days of logs
 * await rotateLogs(30);
 * ```
 */
export async function rotateLogs(daysToKeep: number = 7): Promise<void> {
  try {
    const files = await readdir(LOGS_DIR);
    const logFiles = files.filter(f => f.startsWith('home-monitor-') && f.endsWith('.log'));
    
    if (logFiles.length > daysToKeep) {
      const sortedFiles = logFiles.sort();
      const filesToDelete = sortedFiles.slice(0, sortedFiles.length - daysToKeep);
      
      for (const file of filesToDelete) {
        await unlink(join(LOGS_DIR, file));
        await writeLog(`Deleted old log file: ${file}`, 'server', 'INFO');
      }
    }
  } catch (error) {
    console.error('Failed to rotate logs:', error);
  }
}

/**
 * Retrieves the contents of the current day's log file
 * 
 * First attempts to read today's log file (home-monitor-YYYY-MM-DD.log).
 * If today's file doesn't exist, falls back to the most recent log file.
 * 
 * @returns Log file contents as a string, or error message if no logs exist
 * 
 * @example
 * ```typescript
 * const logs = await getLatestLogs();
 * console.log(logs); // Multi-line string of log entries
 * ```
 */
export async function getLatestLogs(): Promise<string> {
  try {
    const files = await readdir(LOGS_DIR);
    const logFiles = files.filter(f => f.startsWith('home-monitor-') && f.endsWith('.log'));
    
    if (logFiles.length === 0) {
      return 'No logs available';
    }
    
    // Get today's log file
    const today = new Date().toISOString().split('T')[0];
    const todayLogFile = `home-monitor-${today}.log`;
    
    if (logFiles.includes(todayLogFile)) {
      return await readFile(join(LOGS_DIR, todayLogFile), 'utf-8');
    }
    
    // Fallback to most recent log
    const sortedFiles = logFiles.sort().reverse();
    return await readFile(join(LOGS_DIR, sortedFiles[0]), 'utf-8');
  } catch (error) {
    console.error('Failed to read logs:', error);
    return 'Failed to load logs';
  }
}
