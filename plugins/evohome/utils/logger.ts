/**
 * Evohome Logger
 * 
 * Wrapper for global logger with evohome prefix
 */

import { writeLog as globalWriteLog, type LogLevel } from '../../../lib/logger.js';

/**
 * Writes log message with evohome prefix
 * @param message - Log message
 * @param level - Log severity level
 */
export async function writeLog(message: string, level: LogLevel = 'INFO'): Promise<void> {
  await globalWriteLog(message, 'evohome', level);
}
