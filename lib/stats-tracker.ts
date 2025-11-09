/**
 * Statistics Tracker Service
 * 
 * Tracks statistics across operations:
 * - Total runs (successful and failed)
 * - Custom counters (e.g., items processed)
 * - Timestamps and error messages
 * 
 * @module lib/stats-tracker
 */

/**
 * Statistics tracked across operations
 */
export interface Stats {
  /** Total number of operations performed */
  totalRuns: number;
  
  /** Number of successful operations */
  successfulRuns: number;
  
  /** Number of failed operations */
  failedRuns: number;
  
  /** Custom counter for items processed */
  totalItemsProcessed: number;
  
  /** Timestamp of last successful operation */
  lastSuccessfulRun: Date | null;
  
  /** Timestamp of last failed operation */
  lastFailedRun: Date | null;
  
  /** Error message from last failed operation */
  lastError: string | null;
}

/**
 * Statistics Tracker handles cumulative stats
 */
export class StatsTracker {
  private stats: Stats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    totalItemsProcessed: 0,
    lastSuccessfulRun: null,
    lastFailedRun: null,
    lastError: null,
  };

  /**
   * Get current statistics
   */
  getStats(): Stats {
    return this.stats;
  }

  /**
   * Record a successful operation
   * 
   * @param timestamp - When the operation completed
   * @param itemsProcessed - Number of items that were processed
   */
  recordSuccess(timestamp: Date, itemsProcessed: number = 0): void {
    this.stats.totalRuns++;
    this.stats.successfulRuns++;
    this.stats.lastSuccessfulRun = timestamp;
    this.stats.totalItemsProcessed += itemsProcessed;
  }

  /**
   * Record a failed operation
   * 
   * @param timestamp - When the operation failed
   * @param error - Error message
   */
  recordFailure(timestamp: Date, error: string): void {
    this.stats.totalRuns++;
    this.stats.failedRuns++;
    this.stats.lastFailedRun = timestamp;
    this.stats.lastError = error;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalItemsProcessed: 0,
      lastSuccessfulRun: null,
      lastFailedRun: null,
      lastError: null,
    };
  }
}
