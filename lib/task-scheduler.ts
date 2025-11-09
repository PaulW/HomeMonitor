/**
 * Core Task Scheduler Service
 * 
 * Plugin-agnostic task scheduling system that any plugin can use to schedule recurring tasks.
 * 
 * Features:
 * - Task registration with unique IDs
 * - Priority-based operation queue (prevents API rate limiting)
 * - Interval-based scheduling with timer alignment
 * - Status tracking per task (NOT RUN, Pending, Running, OK, Failed)
 * - Dynamic interval updates without restart
 * - Graceful shutdown support
 * 
 * @module task-scheduler
 */

import { writeLog } from './logger.js';

const LOG_SOURCE = 'scheduler';

/**
 * Status for a single task
 */
export interface TaskStatus {
  /** Task identifier */
  taskId: string;
  /** Last execution time */
  lastRun: Date | null;
  /** Next scheduled execution time */
  nextRun: Date | null;
  /** Current task status */
  status: 'NOT RUN' | 'Pending' | 'Running' | 'OK' | 'Failed';
  /** Detailed status message (e.g., error message on failure) */
  statusDetail: string;
  /** Current interval in minutes */
  intervalMinutes: number;
  /** Total number of executions */
  totalRuns: number;
}

/**
 * Task configuration
 */
export interface TaskConfig {
  /** Unique task identifier (e.g., 'evohome:zoneStatus') */
  taskId: string;
  /** Human-readable task label (e.g., 'Zone Status Polling') */
  label: string;
  /** Execution interval in minutes */
  intervalMinutes: number;
  /** Queue priority (lower number = higher priority, 1-10) */
  priority: number;
  /** Task execution function */
  handler: () => Promise<void>;
  /** Whether to run on startup (before first scheduled run) */
  runOnStartup?: boolean;
  /** Minimum threshold (in minutes) for rescheduling when interval changes */
  minRescheduleThreshold?: number;
}

/**
 * Queued operation with priority
 */
interface QueuedOperation {
  taskId: string;
  operation: () => Promise<void>;
  priority: number;
}

/**
 * Plugin-agnostic task scheduler
 * 
 * Manages recurring tasks for all plugins with priority queuing and status tracking.
 */
export class TaskScheduler {
  /** Active timeout references by task ID */
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  /** Task status tracking */
  private taskStatuses: Map<string, TaskStatus> = new Map();
  
  /** Task configurations */
  private taskConfigs: Map<string, TaskConfig> = new Map();
  
  /** Priority-based operation queue */
  private operationQueue: QueuedOperation[] = [];
  
  /** Whether queue is currently being processed */
  private isProcessingQueue: boolean = false;
  
  /** Queue processing debounce timer */
  private queueProcessingTimer: NodeJS.Timeout | null = null;
  
  /** Delay (ms) between queued operations */
  private readonly QUEUE_DELAY_MS = 2000;
  
  /** Debounce delay (ms) for queue processing */
  private readonly QUEUE_DEBOUNCE_MS = 2000;

  /**
   * Registers a new task with the scheduler
   * 
   * @param config - Task configuration
   * @throws If task ID is already registered
   */
  registerTask(config: TaskConfig): void {
    if (this.taskConfigs.has(config.taskId)) {
      throw new Error(`Task '${config.taskId}' is already registered`);
    }

    // Store configuration
    this.taskConfigs.set(config.taskId, config);

    // Initialize status
    this.taskStatuses.set(config.taskId, {
      taskId: config.taskId,
      lastRun: null,
      nextRun: null,
      status: 'NOT RUN',
      statusDetail: '',
      intervalMinutes: config.intervalMinutes,
      totalRuns: 0,
    });

    writeLog(`Registered task: ${config.label} (${config.taskId}) - every ${config.intervalMinutes}m, priority ${config.priority}`, LOG_SOURCE, 'INFO');
  }

  /**
   * Starts all registered tasks
   * 
   * Queues startup tasks (if configured) and schedules recurring executions.
   */
  async startAllTasks(): Promise<void> {
    writeLog('Starting task scheduler...', LOG_SOURCE, 'INFO');

    // Sort tasks by priority for startup execution
    const sortedTasks = Array.from(this.taskConfigs.values())
      .sort((a, b) => a.priority - b.priority);

    // Queue startup tasks
    for (const config of sortedTasks) {
      if (config.runOnStartup) {
        this.queueOperation(config.taskId, async () => {
          await this.executeTask(config.taskId);
        }, config.priority);
      }
    }

    // Schedule all recurring tasks
    for (const config of sortedTasks) {
      this.scheduleTask(config.taskId);
    }
  }

  /**
   * Stops all tasks and clears the queue
   */
  stopAllTasks(): void {
    writeLog('Stopping task scheduler...', LOG_SOURCE, 'INFO');

    // Clear all timers
    for (const [taskId, timer] of this.timers) {
      clearTimeout(timer);
      writeLog(`Stopped task: ${taskId}`, LOG_SOURCE, 'DEBUG');
    }
    this.timers.clear();

    // Clear queue processing timer
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
      this.queueProcessingTimer = null;
    }

    // Clear operation queue
    this.operationQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Updates the interval for a specific task
   * 
   * Intelligently reschedules the task:
   * - If next run is far away: Cancels current timeout and reschedules immediately
   * - If next run is soon: Lets current timeout complete, new interval applies to next run
   * 
   * @param taskId - Task identifier
   * @param newIntervalMinutes - New interval in minutes
   */
  updateTaskInterval(taskId: string, newIntervalMinutes: number): void {
    const config = this.taskConfigs.get(taskId);
    const status = this.taskStatuses.get(taskId);

    if (!config || !status) {
      writeLog(`Cannot update interval: task '${taskId}' not found`, LOG_SOURCE, 'WARNING');
      return;
    }

    // Skip if interval hasn't changed
    if (newIntervalMinutes === status.intervalMinutes) {
      return;
    }

    const now = Date.now();
    const minThresholdMs = (config.minRescheduleThreshold || 5) * 60 * 1000;
    const timeUntilNextRun = status.nextRun 
      ? status.nextRun.getTime() - now 
      : 0;

    if (timeUntilNextRun > minThresholdMs) {
      // Next run is far away - reschedule now
      writeLog(
        `${config.label} interval changed: ${status.intervalMinutes}m → ${newIntervalMinutes}m ` +
        `(next run in ${Math.round(timeUntilNextRun / 1000)}s > ${minThresholdMs / 1000}s min, rescheduling now)`,
        LOG_SOURCE,
        'INFO'
      );
      
      // Update config
      config.intervalMinutes = newIntervalMinutes;
      status.intervalMinutes = newIntervalMinutes;
      
      // Reschedule
      this.scheduleTask(taskId);
    } else {
      // Next run is soon - update interval but let current timeout complete
      writeLog(
        `${config.label} interval changed: ${status.intervalMinutes}m → ${newIntervalMinutes}m ` +
        `(next run in ${Math.round(timeUntilNextRun / 1000)}s, new interval will apply after current run completes)`,
        LOG_SOURCE,
        'INFO'
      );
      
      // Update interval immediately so it's used for next scheduling
      config.intervalMinutes = newIntervalMinutes;
      status.intervalMinutes = newIntervalMinutes;
    }
  }

  /**
   * Gets the current status of a specific task
   * 
   * @param taskId - Task identifier
   * @returns Task status or undefined if not found
   */
  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.taskStatuses.get(taskId);
  }

  /**
   * Gets all task statuses
   * 
   * @returns Map of task IDs to their statuses
   */
  getAllTaskStatuses(): Map<string, TaskStatus> {
    return new Map(this.taskStatuses);
  }

  /**
   * Schedules a task for recurring execution
   * 
   * @param taskId - Task identifier
   * @private
   */
  private scheduleTask(taskId: string): void {
    const config = this.taskConfigs.get(taskId);
    const status = this.taskStatuses.get(taskId);

    if (!config || !status) {
      return;
    }

    // Clear existing timer
    const existingTimer = this.timers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate initial delay to align with hour
    const initialDelay = this.getNextAlignedDelay(config.intervalMinutes);
    status.nextRun = new Date(Date.now() + initialDelay);

    writeLog(`${config.label} next run in ${Math.round(initialDelay / 1000)}s`, LOG_SOURCE, 'DEBUG');

    // Schedule first run
    const timer = setTimeout(() => {
      status.status = 'Pending';
      status.statusDetail = '';
      this.queueOperation(taskId, async () => {
        await this.executeTask(taskId);
      }, config.priority);
    }, initialDelay);

    this.timers.set(taskId, timer);
  }

  /**
   * Schedules the next run of a task after completion
   * 
   * Always aligns to HH:MM:00 (zero seconds) to prevent time creep.
   * 
   * @param taskId - Task identifier
   * @private
   */
  private scheduleNextRun(taskId: string): void {
    const config = this.taskConfigs.get(taskId);
    const status = this.taskStatuses.get(taskId);

    if (!config || !status) {
      return;
    }

    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentMs = now.getMilliseconds();

    // Calculate how many intervals have passed in this hour
    const intervalsPassed = Math.floor(currentMinutes / status.intervalMinutes);

    // Calculate the next interval time
    const nextIntervalMinute = (intervalsPassed + 1) * status.intervalMinutes;

    let nextDelay: number;

    // If next interval is in the next hour
    if (nextIntervalMinute >= 60) {
      const minutesUntilNextHour = 60 - currentMinutes;
      const secondsUntilNextHour = 60 - currentSeconds;
      const msUntilNextHour = 1000 - currentMs;
      nextDelay = (minutesUntilNextHour - 1) * 60 * 1000 + secondsUntilNextHour * 1000 + msUntilNextHour;
    } else {
      // Calculate delay to next interval in this hour (aligned to :00 seconds)
      const minutesUntilNext = nextIntervalMinute - currentMinutes;
      const secondsUntilNext = 60 - currentSeconds;
      const msUntilNext = 1000 - currentMs;
      nextDelay = (minutesUntilNext - 1) * 60 * 1000 + secondsUntilNext * 1000 + msUntilNext;
    }

    status.nextRun = new Date(Date.now() + nextDelay);

    // Schedule next run
    const timer = setTimeout(() => {
      status.status = 'Pending';
      status.statusDetail = '';
      this.queueOperation(taskId, async () => {
        await this.executeTask(taskId);
      }, config.priority);
    }, nextDelay);

    this.timers.set(taskId, timer);
  }

  /**
   * Calculates the next aligned execution time for a given interval
   * 
   * Synchronizes execution to round intervals from the hour:
   * - 5 minutes: runs at :00, :05, :10, :15, etc.
   * - 30 minutes: runs at :00, :30
   * - 60 minutes: runs at :00
   * 
   * @param intervalMinutes - Interval in minutes
   * @returns Milliseconds until next aligned time
   * @private
   */
  private getNextAlignedDelay(intervalMinutes: number): number {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentMs = now.getMilliseconds();

    // Calculate how many intervals have passed in this hour
    const intervalsPassed = Math.floor(currentMinutes / intervalMinutes);

    // Calculate the next interval time
    const nextIntervalMinute = (intervalsPassed + 1) * intervalMinutes;

    // If next interval is in the next hour
    if (nextIntervalMinute >= 60) {
      const minutesUntilNextHour = 60 - currentMinutes;
      const secondsUntilNextHour = 60 - currentSeconds;
      const msUntilNextHour = 1000 - currentMs;
      return (minutesUntilNextHour - 1) * 60 * 1000 + secondsUntilNextHour * 1000 + msUntilNextHour;
    }

    // Calculate delay to next interval in this hour
    const minutesUntilNext = nextIntervalMinute - currentMinutes;
    const secondsUntilNext = 60 - currentSeconds;
    const msUntilNext = 1000 - currentMs;
    return (minutesUntilNext - 1) * 60 * 1000 + secondsUntilNext * 1000 + msUntilNext;
  }

  /**
   * Executes a task and updates its status
   * 
   * @param taskId - Task identifier
   * @private
   */
  private async executeTask(taskId: string): Promise<void> {
    const config = this.taskConfigs.get(taskId);
    const status = this.taskStatuses.get(taskId);

    if (!config || !status) {
      return;
    }

    status.status = 'Running';
    status.statusDetail = '';
    status.totalRuns++;

    try {
      await config.handler();
      status.status = 'OK';
      status.statusDetail = '';
    } catch (error) {
      status.status = 'Failed';
      status.statusDetail = error instanceof Error ? error.message : String(error);
      writeLog(`Task '${config.label}' failed: ${status.statusDetail}`, LOG_SOURCE, 'ERROR');
    } finally {
      status.lastRun = new Date();
      // Schedule the next run only after this one completes
      this.scheduleNextRun(taskId);
    }
  }

  /**
   * Adds an operation to the queue and processes it
   * 
   * Ensures operations are executed sequentially with delays between them
   * to avoid overwhelming APIs. Operations are executed in priority order.
   * 
   * @param taskId - Task identifier
   * @param operation - Async operation to queue
   * @param priority - Priority level (lower number = higher priority)
   * @private
   */
  private queueOperation(taskId: string, operation: () => Promise<void>, priority: number): void {
    // Check if this task is already queued
    const alreadyQueued = this.operationQueue.some(item => item.taskId === taskId);
    if (alreadyQueued) {
      writeLog(`Task '${taskId}' is already queued, skipping duplicate`, LOG_SOURCE, 'DEBUG');
      return;
    }

    this.operationQueue.push({ taskId, operation, priority });

    // Clear any existing timer
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
    }

    // Set a debounce timer
    // If more operations are added during this time, the timer resets
    this.queueProcessingTimer = setTimeout(() => {
      this.queueProcessingTimer = null;

      // Sort by priority before processing (lower number = higher priority)
      this.operationQueue.sort((a, b) => a.priority - b.priority);

      writeLog(`Starting queued operations processing (${this.operationQueue.length} tasks)`, LOG_SOURCE, 'DEBUG');

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    }, this.QUEUE_DEBOUNCE_MS);

    writeLog(`Queued operation '${taskId}' (priority ${priority}). Processing will start in ${this.QUEUE_DEBOUNCE_MS / 1000}s`, LOG_SOURCE, 'DEBUG');
  }

  /**
   * Processes the operation queue
   * 
   * Executes queued operations one at a time in priority order with delays between them.
   * Re-sorts the queue before each operation to handle newly added high-priority items.
   * 
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      // Re-sort before each operation in case new items were added
      this.operationQueue.sort((a, b) => a.priority - b.priority);

      const item = this.operationQueue.shift();
      if (item) {
        try {
          await item.operation();
        } catch (error) {
          writeLog(`Operation '${item.taskId}' failed: ${error instanceof Error ? error.message : String(error)}`, LOG_SOURCE, 'ERROR');
        }

        // Delay between operations to avoid rate limiting
        if (this.operationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.QUEUE_DELAY_MS));
        }
      }
    }

    this.isProcessingQueue = false;
  }
}
