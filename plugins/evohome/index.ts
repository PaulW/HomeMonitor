/**
 * EvoHome Plugin for Home Monitor
 * 
 * Provides monitoring and control for Honeywell EvoHome heating systems.
 * 
 * Features:
 * - Real-time temperature monitoring for all zones
 * - Dashboard with room cards showing current/target temps
 * - Override detection and automatic reset based on time-based rules
 * - Schedule viewer and editor for all zones
 * - Polling operations with configurable intervals
 * - API statistics tracking (V1/V2 authentication, GET/PUT requests)
 * - Session caching to minimize API calls
 * - Comprehensive statistics and health monitoring
 * 
 * Pages:
 * - /evohome - Dashboard with all room temperature cards
 * - /evohome/status - System status, API statistics, and polling operations
 * - /evohome/override-control - Time-based override rule configuration
 * - /evohome/scheduler - Zone schedule viewer and editor
 * - /evohome/settings - System settings and configuration
 * 
 * API Endpoints:
 * - GET /api/evohome/status - Current system status, polling status, and API stats
 * - GET /api/evohome/polling-status - Detailed polling operation status
 * - GET /api/evohome/config - Override rules configuration
 * - POST /api/evohome/config - Update override rules
 * - POST /api/evohome/run - Manual check trigger
 * 
 * @module plugins/evohome
 */

import { Router } from 'express';
import { Plugin, PluginMetadata, MenuItem } from '../../lib/plugin-interface.js';
import { writeLog } from '../../lib/logger.js';
import { getConfigManager } from '../../lib/config/index.js';
import { evohomeConfigSchema } from './centralized-config-schema.js';
import { setupRoutes, RouteServices, PluginState } from './routes.js';
import { ZoneService } from './services/zone-service.js';
import { OverrideService } from './services/override-service.js';
import { ScheduleService } from './services/schedule-service.js';
import { TaskScheduler, TaskStatus } from '../../lib/task-scheduler.js';
import { StatsTracker, type Stats } from '../../lib/stats-tracker.js';
import { ApiStatsTracker, type ApiStatistics } from './services/api-stats-tracker.js';
import { DeviceCacheService } from './services/device-cache-service.js';
import { AuthManager } from './api/auth-manager.js';
import { V1ApiClient } from './api/v1-api.js';
import { V2ApiClient } from './api/v2-api.js';
import { ServiceInitializer } from './utils/service-initializer.js';
import type { Config } from './types/config.types.js';
import type { ZoneSchedule, DaySchedule } from './types/schedule.types.js';

/**
 * Polling status compatible with old interface
 */
export interface PollingStatus {
  zoneStatus: TaskStatus;
  overrideReset: TaskStatus;
  scheduleRefresh: TaskStatus;
}

/**
 * Result from a single EvoHome check operation
 */
interface CheckResult {
  /** Whether the check completed successfully */
  success: boolean;
  
  /** Timestamp when the check was performed */
  timestamp: Date;
  
  /** Array of device/zone data */
  devices: any[];
  
  /** Number of overrides that were reset */
  overridesReset: number;
  
  /** Error message if check failed */
  error?: string;
}

/**
 * EvoHome plugin implementation
 * 
 * Manages scheduled checks, statistics, and provides routes for
 * dashboard and override control functionality.
 */
export class EvoHomePlugin implements Plugin {
  /** Plugin identification and display metadata */
  metadata: PluginMetadata = {
    id: 'evohome',
    name: 'EvoHome',
    description: 'Honeywell EvoHome monitoring and override prevention',
    icon: '🌡️',
    version: '1.0.0',
  };

  /** Express router for plugin routes */
  private router: Router;
  
  /** Current configuration loaded from database */
  private currentConfig: Config = {} as Config;
  
  /** Service instances for business logic */
  private authManager: AuthManager;
  private v1Api: V1ApiClient;
  private v2Api: V2ApiClient;
  private zoneService: ZoneService;
  private overrideService: OverrideService;
  private scheduleService: ScheduleService;
  private taskScheduler: TaskScheduler;
  private statsTracker: StatsTracker;
  private apiStatsTracker: ApiStatsTracker;
  private deviceCache: DeviceCacheService;
  
  /** Result from the most recent check */
  private lastResult: CheckResult | null = null;
  
  /** Whether a check is currently in progress */
  private isRunning: boolean = false;
  
  /** Timestamp when the next scheduled check will run */
  private nextRunTime: Date | null = null;

  /** Cached zone schedules */
  private zoneSchedules: any[] = [];
  
  /** Authentication status */
  private isAuthenticated: boolean = false;
  private authRetryTimer: NodeJS.Timeout | null = null;
  private readonly AUTH_RETRY_INTERVAL = 60 * 1000; // 1 minute

  /** Check interval in milliseconds (5 minutes) */
  private readonly CHECK_INTERVAL = 5 * 60 * 1000;

  /**
   * Initializes the plugin instance
   * Sets up service instances and Express router
   * 
   * Note: Services are initialized with empty config object.
   * The config is loaded from database in init() and then reloadConfig() is called.
   */
  constructor() {
    // Initialize all services using ServiceInitializer
    // Pass a getter function that always returns the current config
    const services = ServiceInitializer.createServices(() => this.currentConfig);
    
    // Assign services to instance properties (excluding configManager - using centralized one)
    this.authManager = services.authManager;
    this.v1Api = services.v1Api;
    this.v2Api = services.v2Api;
    this.zoneService = services.zoneService;
    this.overrideService = services.overrideService;
    this.scheduleService = services.scheduleService;
    this.taskScheduler = services.taskScheduler;
    this.statsTracker = services.statsTracker;
    this.apiStatsTracker = services.apiStatsTracker;
    this.deviceCache = services.deviceCache;
    
    // Set up router with route handlers
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Initializes plugin on server startup
   * 
   * Registers config schema with centralized ConfigManager.
   * Loads config and updates all services.
   * Called once by plugin loader before routes are registered.
   * 
   * @throws {Error} If initialization fails
   */
  async init(): Promise<void> {
    await writeLog('Initializing EvoHome plugin...', 'evohome', 'INFO');
    
    // Register config schema with centralized manager
    const configManager = getConfigManager();
    configManager.registerSchema<Config>('evohome', evohomeConfigSchema);
    
    // Check if plugin has configuration
    const hasConfig = await configManager.hasConfig('evohome');
    if (hasConfig) {
      const config = await configManager.getConfig<Config>('evohome');
      await writeLog(`Config loaded from database (username: ${config?.credentials?.username})`, 'evohome', 'INFO');
      
      // Load config into all services
      if (config) {
        await this.reloadConfig();
      }
    } else {
      await writeLog('No config found - plugin needs to be configured', 'evohome', 'WARNING');
    }
  }

  /**
   * Returns navigation menu items for this plugin
   * 
   * Provides five pages:
   * - Dashboard: Room temperature cards with real-time updates
   * - Override Control: Time-based override rule configuration
   * - Scheduler: Zone schedule viewer and editor
   * - Status: API statistics and polling operations monitoring
   * - Settings: System configuration
   * 
   * @returns Array of menu items for sidebar navigation
   */
  getMenuItems(): MenuItem[] {
    return [
      {
        label: 'Dashboard',
        path: '/plugin/evohome',
        icon: '📊',
      },
      {
        label: 'Override Control',
        path: '/plugin/evohome/override-control',
        icon: '⚙️',
      },
      {
        label: 'Scheduler',
        path: '/plugin/evohome/scheduler',
        icon: '📅',
      },
      {
        label: 'Status',
        path: '/plugin/evohome/status',
        icon: '📡',
      },
      {
        label: 'Settings',
        path: '/plugin/evohome/settings',
        icon: '🔧',
      },
    ];
  }

  /**
   * Returns the Express router with all plugin routes
   * 
   * @returns Router instance with configured routes
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Attempts to authenticate with both V2 and V1 APIs
   * 
   * This ensures both authentication tokens are valid before starting polling operations.
   * V2 API is used for real-time data, V1 API is used for schedules.
   * 
   * @returns Promise<boolean> - true if authentication successful, false otherwise
   * @private
   */
  private async attemptAuthentication(retryV1: boolean = true, retryV2: boolean = true): Promise<boolean> {
    await writeLog('Initializing authentication...', 'evohome', 'INFO');
    
    const configManager = getConfigManager();
    const config = await configManager.getConfig<Config>('evohome');
    
    if (!config) {
      await writeLog('Plugin not configured - authentication skipped', 'evohome', 'WARNING');
      return false;
    }
    
    let v1Success = !retryV1; // If not retrying V1, assume it's already successful
    let v2Success = !retryV2; // If not retrying V2, assume it's already successful
    
    // Test V2 authentication by getting a session (only if needed)
    if (retryV2) {
      try {
        await writeLog('Testing V2 API authentication...', 'evohome', 'INFO');
        await this.authManager.getV2Session(config);
        await writeLog('✅ V2 API authentication successful', 'evohome', 'INFO');
        v2Success = true;
      } catch (error) {
        await writeLog(`❌ V2 API authentication failed: ${error instanceof Error ? error.message : String(error)}`, 'evohome', 'ERROR');
        v2Success = false;
      }
    }
    
    // Test V1 authentication by getting a bearer token (only if needed)
    if (retryV1) {
      try {
        await writeLog('Testing V1 API authentication...', 'evohome', 'INFO');
        await this.authManager.getV1Token(config);
        await writeLog('✅ V1 API authentication successful', 'evohome', 'INFO');
        v1Success = true;
      } catch (error) {
        await writeLog(`❌ V1 API authentication failed: ${error instanceof Error ? error.message : String(error)}`, 'evohome', 'ERROR');
        v1Success = false;
      }
    }
    
    // Check if both are successful
    if (v1Success && v2Success) {
      this.isAuthenticated = true;
      await writeLog('✅ Authentication initialization complete', 'evohome', 'INFO');
      
      // Clear any retry timer
      if (this.authRetryTimer) {
        clearTimeout(this.authRetryTimer);
        this.authRetryTimer = null;
      }
      
      return true;
    } else {
      this.isAuthenticated = false;
      
      // Determine which APIs need retry
      const failedApis: string[] = [];
      if (!v1Success) failedApis.push('V1');
      if (!v2Success) failedApis.push('V2');
      
      await writeLog(`Authentication failed for: ${failedApis.join(', ')}`, 'evohome', 'ERROR');
      await writeLog(`Will retry ${failedApis.join(' and ')} authentication in ${this.AUTH_RETRY_INTERVAL / 1000} seconds...`, 'evohome', 'INFO');
      
      // Schedule retry only for failed APIs
      this.authRetryTimer = setTimeout(async () => {
        await writeLog(`Retrying ${failedApis.join(' and ')} authentication...`, 'evohome', 'INFO');
        const success = await this.attemptAuthentication(!v1Success, !v2Success);
        if (success) {
          // Authentication succeeded, start polling
          await this.startPollingOperations();
        }
      }, this.AUTH_RETRY_INTERVAL);
      
      return false;
    }
  }

  /**
   * Starts all polling operations
   * Should only be called after successful authentication
   * 
   * @private
   */
  private async startPollingOperations(): Promise<void> {
    // Load config to get polling intervals
    const configManager = getConfigManager();
    const config = await configManager.getConfig<Config>('evohome');
    
    if (!config) {
      await writeLog('Plugin not configured - polling not started', 'evohome', 'WARNING');
      return;
    }
    
    // Ensure polling config exists with defaults
    const polling = config.polling || {
      zoneStatus: 1,
      overrideReset: 5,
      scheduleRefresh: 30
    };
    
    // Register tasks with the core scheduler
    this.taskScheduler.registerTask({
      taskId: 'evohome:zoneStatus',
      label: 'Zone Status Polling',
      intervalMinutes: polling.zoneStatus,
      priority: 1, // Highest priority - must run first
      handler: async () => { await this.performCheck(false, 'zone-status'); },
      runOnStartup: true,
      minRescheduleThreshold: 5
    });
    
    this.taskScheduler.registerTask({
      taskId: 'evohome:scheduleRefresh',
      label: 'Schedule Refresh',
      intervalMinutes: polling.scheduleRefresh,
      priority: 2, // Second priority - runs after zone status
      handler: async () => { await this.performScheduleRefresh(); },
      runOnStartup: true,
      minRescheduleThreshold: 5
    });
    
    this.taskScheduler.registerTask({
      taskId: 'evohome:overrideReset',
      label: 'Override Reset Check',
      intervalMinutes: polling.overrideReset,
      priority: 3, // Lowest priority - runs last
      handler: async () => { await this.performOverrideReset(); },
      runOnStartup: false, // Don't run on startup
      minRescheduleThreshold: 5
    });
    
    // Start all tasks
    await this.taskScheduler.startAllTasks();
  }

  /**
   * Starts the plugin's background tasks
   * 
   * Sets up three separate timers for different operations:
   * - Zone status polling (temperature data)
   * - Override reset checks
   * - Schedule refresh
   * 
   * Each timer is synchronized to run at aligned intervals from the hour.
   * Operations are queued to prevent concurrent API calls.
   * 
   * Skips polling if credentials are not configured.
   */
  async start(): Promise<void> {
    await writeLog('Starting EvoHome scheduler...', 'evohome', 'INFO');
    
    // Check if configured before starting
    const isConfigured = await this.checkIfConfigured();
    if (!isConfigured) {
      await writeLog('EvoHome not configured - skipping scheduled checks. Please configure credentials in Settings.', 'evohome', 'WARNING');
      return;
    }
    
    // Attempt authentication first
    const authSuccess = await this.attemptAuthentication();
    
    if (!authSuccess) {
      await writeLog('Initial authentication failed - will retry periodically. Polling not started.', 'evohome', 'WARNING');
      return;
    }
    
    // Start polling operations
    await this.startPollingOperations();
  }

  /**
   * Stops the plugin's background tasks
   * 
   * Clears all scheduled timers and clears the operation queue.
   */
  stop(): void {
    writeLog('Stopping EvoHome scheduler...', 'evohome', 'INFO');
    
    // Stop task scheduler
    this.taskScheduler.stopAllTasks();
    
    // Clear auth retry timer
    if (this.authRetryTimer) {
      clearTimeout(this.authRetryTimer);
      this.authRetryTimer = null;
    }
  }

  /**
   * Updates polling intervals without restarting scheduler
   * 
   * Only restarts tasks if their next run is beyond the minimum interval.
   * Otherwise, the new interval takes effect after the current task completes.
   * 
   * @param newIntervals - New polling intervals (only specify what changed)
   */
  updatePollingIntervals(newIntervals: {
    zoneStatus?: number;
    overrideReset?: number;
    scheduleRefresh?: number;
  }): void {
    writeLog('Updating polling intervals...', 'evohome', 'INFO');
    
    if (newIntervals.zoneStatus !== undefined) {
      this.taskScheduler.updateTaskInterval('evohome:zoneStatus', newIntervals.zoneStatus);
    }
    
    if (newIntervals.overrideReset !== undefined) {
      this.taskScheduler.updateTaskInterval('evohome:overrideReset', newIntervals.overrideReset);
    }
    
    if (newIntervals.scheduleRefresh !== undefined) {
      this.taskScheduler.updateTaskInterval('evohome:scheduleRefresh', newIntervals.scheduleRefresh);
    }
  }

  /**
   * Reloads configuration from database into all services
   * 
   * Called after configuration is updated via the Settings or Override Control pages.
   * Ensures all services use the latest configuration without requiring a plugin restart.
   * 
   * @returns Promise that resolves when all services have been updated
   */
  async reloadConfig(): Promise<void> {
    await writeLog('Reloading configuration into all services...', 'evohome', 'INFO');
    
    try {
      const configManager = getConfigManager();
      const config = await configManager.getConfig<Config>('evohome');
      
      if (!config) {
        await writeLog('No configuration found - services not updated', 'evohome', 'WARNING');
        return;
      }
      
      // Update the current config reference (used by API clients via getter)
      this.currentConfig = config;
      
      // Update config in all services that use it
      await this.zoneService.updateConfig(config);
      await this.overrideService.updateConfig(config);
      await this.scheduleService.updateConfig(config);
      
      await writeLog('✅ Configuration reloaded successfully', 'evohome', 'INFO');
    } catch (error) {
      await writeLog(`Failed to reload configuration: ${error instanceof Error ? error.message : String(error)}`, 'evohome', 'ERROR');
      throw error;
    }
  }

  /**
   * Checks if the plugin has valid credentials configured
   * 
   * @returns True if username and password are set, false otherwise
   * @private
   */
  private async checkIfConfigured(): Promise<boolean> {
    try {
      const configManager = getConfigManager();
      const config = await configManager.getConfig<Config>('evohome');
      return !!(config?.credentials?.username && config?.credentials?.password);
    } catch {
      return false;
    }
  }

  /**
   * Performs a single EvoHome check operation
   * 
   * Prevents concurrent checks (only one can run at a time).
   * Updates statistics and stores result for status API.
   * Logs success/failure to global logger.
   * 
   * Process:
   * 1. Check if configured (skip if not)
   * 2. Check if another operation is in progress (throw if so)
   * 3. Call runEvoHomeCheck() from core module
   * 4. Update statistics based on result
   * 5. Store result for API access
   * 6. Calculate next run time
   * 
   * @param manual - True if triggered manually via API, false if scheduled
   * @param operationType - Type of operation: 'zone-status' or 'override-reset'
   * @returns CheckResult with success status, devices, and overrides reset
   * @throws {Error} If a check is already in progress or not configured
   * 
   * @private
   */
  private async performCheck(manual: boolean, operationType: string = 'zone-status'): Promise<CheckResult> {
    // Check if configured
    const isConfigured = await this.checkIfConfigured();
    if (!isConfigured) {
      const error = 'Plugin not configured - please set credentials in Settings';
      await writeLog(error, 'evohome', 'WARNING');
      throw new Error(error);
    }
    
    if (this.isRunning) {
      throw new Error('Check already in progress');
    }

    this.isRunning = true;
    const source = manual ? 'manual' : operationType;
    
    try {
      const result = await this.zoneService.checkZoneStatus();
      this.lastResult = result;
      
      // Store raw device data in cache for optimistic updates and override reset operations
      if (result.success && result.rawDevices) {
        this.deviceCache.setDevices(result.rawDevices);
      }
      
      // Update stats using stats tracker
      if (result.success) {
        this.statsTracker.recordSuccess(result.timestamp, result.overridesReset);
        await writeLog(`✅ Check completed successfully`, 'evohome', 'INFO');
      } else {
        this.statsTracker.recordFailure(result.timestamp, result.error || 'Unknown error');
        await writeLog(`Check failed: ${result.error}`, 'evohome', 'ERROR');
      }
      
      return result;
    } finally {
      this.isRunning = false;
      this.nextRunTime = new Date(Date.now() + this.CHECK_INTERVAL);
    }
  }

  /**
   * Performs a schedule refresh operation
   * 
   * Fetches the latest schedules from the EvoHome API and updates the device cache.
   * 
   * @throws {Error} If schedule fetch fails
   * @private
   */
  private async performScheduleRefresh(): Promise<void> {
    try {
      const result = await this.scheduleService.fetchAllSchedules();
      
      if (result.success) {
        await writeLog(`✅ Schedule refresh completed successfully. Fetched ${result.schedules.length} zone schedules.`, 'evohome', 'INFO');
        
        // Store schedules in memory for UI access
        this.zoneSchedules = result.schedules;
        
        // Update device cache with new schedules
        this.deviceCache.setZoneSchedules(result.schedules);
      } else {
        await writeLog(`Schedule refresh failed: ${result.error}`, 'evohome', 'ERROR');
        throw new Error(result.error || 'Schedule refresh failed');
      }
      
    } catch (error) {
      await writeLog(`Schedule refresh failed: ${error instanceof Error ? error.message : String(error)}`, 'evohome', 'ERROR');
      throw error; // Re-throw so the polling system can track the failure
    }
  }

  /**
   * Performs override reset check without full zone status update
   * 
   * @throws {Error} If not configured or override check fails
   * @private
   */
  private async performOverrideReset(): Promise<void> {
    // Check if configured
    const isConfigured = await this.checkIfConfigured();
    if (!isConfigured) {
      const error = 'Plugin not configured - please set credentials in Settings';
      await writeLog(error, 'evohome', 'WARNING');
      throw new Error(error);
    }

    try {
      // Use cached device data from the device cache
      const cachedDevices = this.deviceCache.getDevices();
      const result = await this.overrideService.checkAndResetOverrides(cachedDevices || undefined);
      
      if (result.success) {
        await writeLog(`✅ Override reset check completed. Overrides reset: ${result.overridesReset}`, 'evohome', 'INFO');
      } else {
        await writeLog(`Override reset check failed: ${result.error}`, 'evohome', 'ERROR');
        throw new Error(result.error || 'Override reset check failed');
      }
      
    } catch (error) {
      await writeLog(`Override reset check failed: ${error instanceof Error ? error.message : String(error)}`, 'evohome', 'ERROR');
      throw error; // Re-throw so the polling system can track the failure
    }
  }

  /**
   * Sets up all HTTP routes for the plugin using the routes module
   * 
   * @private
   */
  private setupRoutes(): void {
    // Prepare services container for route handlers
    const services: RouteServices = {
      zoneService: this.zoneService,
      overrideService: this.overrideService,
      scheduleService: this.scheduleService,
      // Note: configManager not passed - routes will use getConfigManager() directly
      authManager: this.authManager,
      v1Api: this.v1Api,
      v2Api: this.v2Api,
      deviceCache: this.deviceCache,
    };

    // Capture reference to this plugin instance
    const self = this;

    // Prepare plugin state accessor for route handlers
    // Use getters to ensure routes always see current state
    const state: PluginState = {
      get lastResult() { return self.lastResult; },
      get stats() { return self.statsTracker.getStats(); },
      get apiStats() { return self.apiStatsTracker.getStats(); },
      get isRunning() { return self.isRunning; },
      get nextRunTime() { return self.nextRunTime; },
      get pollingStatus() { 
        // Convert TaskStatus map to PollingStatus interface
        const zoneStatus = self.taskScheduler.getTaskStatus('evohome:zoneStatus');
        const overrideReset = self.taskScheduler.getTaskStatus('evohome:overrideReset');
        const scheduleRefresh = self.taskScheduler.getTaskStatus('evohome:scheduleRefresh');
        
        return {
          zoneStatus: zoneStatus || {
            taskId: 'evohome:zoneStatus',
            lastRun: null,
            nextRun: null,
            status: 'NOT RUN',
            statusDetail: '',
            intervalMinutes: 1,
            totalRuns: 0
          },
          overrideReset: overrideReset || {
            taskId: 'evohome:overrideReset',
            lastRun: null,
            nextRun: null,
            status: 'NOT RUN',
            statusDetail: '',
            intervalMinutes: 5,
            totalRuns: 0
          },
          scheduleRefresh: scheduleRefresh || {
            taskId: 'evohome:scheduleRefresh',
            lastRun: null,
            nextRun: null,
            status: 'NOT RUN',
            statusDetail: '',
            intervalMinutes: 30,
            totalRuns: 0
          }
        };
      },
      get zoneSchedules() { return self.zoneSchedules; },
      performCheck: this.performCheck.bind(this),
      stop: this.stop.bind(this),
      start: this.start.bind(this),
      reloadConfig: this.reloadConfig.bind(this),
      updatePollingIntervals: this.updatePollingIntervals.bind(this),
      updateCachedDeviceState: (deviceId: number, temperature: number, status: string) => {
        self.deviceCache.updateDeviceState(deviceId, temperature, status);
      },
      updateCachedDHWState: (deviceId: number, mode: string, status: string) => {
        self.deviceCache.updateDHWState(deviceId, mode, status);
      },
      getCachedDeviceState: (deviceId: number) => {
        return self.deviceCache.getDeviceState(deviceId, self.zoneService.getDeviceDetails.bind(self.zoneService));
      },
    };

    // Get configured router from routes module
    this.router = setupRoutes(services, state);
  }
}

// Export plugin instance
const plugin = new EvoHomePlugin();
export default plugin;
