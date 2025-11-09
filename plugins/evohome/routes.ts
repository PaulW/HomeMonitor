/**
 * EvoHome Plugin Routes
 * 
 * Defines all HTTP routes for the EvoHome plugin, including:
 * - HTML template routes for dashboard, status, scheduler, override control, and settings pages
 * - API endpoints for zone data, polling status, API statistics, and configuration
 * - Manual operation triggers for testing and maintenance
 * 
 * @module plugins/evohome/routes
 */

import { Router, Request, Response } from 'express';
import { writeLog } from '../../lib/logger.js';
import { getConfigManager } from '../../lib/config/index.js';
import { ZoneService } from './services/zone-service.js';
import { OverrideService } from './services/override-service.js';
import { ScheduleService } from './services/schedule-service.js';
import { DeviceCacheService } from './services/device-cache-service.js';
import { AuthManager } from './api/auth-manager.js';
import { V1ApiClient } from './api/v1-api.js';
import { V2ApiClient } from './api/v2-api.js';
import { Config } from './types/config.types.js';
import { CONFIG_SCHEMA } from './config-schema.js';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  validateRequiredFields,
  parseFloatSafe,
  parseIntSafe,
} from '../../lib/route-helpers.js';
import { renderPluginTemplate } from '../../lib/template-renderer.js';

/**
 * Services container for route handlers
 * Note: configManager removed - routes use getConfigManager() directly
 */
export interface RouteServices {
  zoneService: ZoneService;
  overrideService: OverrideService;
  scheduleService: ScheduleService;
  authManager: AuthManager;
  v1Api: V1ApiClient;
  v2Api: V2ApiClient;
  deviceCache: DeviceCacheService;
}

/**
 * Plugin state needed by routes
 */
export interface PluginState {
  /** Last zone check result data */
  lastResult: any | null;
  /** General statistics */
  stats: any;
  /** API statistics tracking (V1 and V2 operations) */
  apiStats: any;
  /** Whether a check is currently running */
  isRunning: boolean;
  /** Next scheduled run time */
  nextRunTime: Date | null;
  /** Polling operations status and timers */
  pollingStatus: any;
  /** Cached zone schedules */
  zoneSchedules: any[];
  /** Perform a zone check */
  performCheck: (manual: boolean) => Promise<any>;
  /** Stop the plugin */
  stop: () => void;
  /** Start the plugin */
  start: () => Promise<void>;
  /** Reload configuration from database */
  reloadConfig: () => Promise<void>;
  /** Update polling intervals */
  updatePollingIntervals: (intervals: { zoneStatus?: number; overrideReset?: number; scheduleRefresh?: number }) => void;
  /** Update cached device state */
  updateCachedDeviceState: (deviceId: number, temperature: number, status: string) => void;
  /** Update cached DHW state */
  updateCachedDHWState: (deviceId: number, mode: string, status: string) => void;
  /** Get cached device state */
  getCachedDeviceState: (deviceId: number) => any | null;
}

/**
 * Sets up all routes for the EvoHome plugin
 * 
 * @param services - Service instances for business logic
 * @param state - Plugin state for route handlers
 * @returns Configured Express Router
 */
export function setupRoutes(services: RouteServices, state: PluginState): Router {
  const router = Router();

  // ============================================================================
  // HTML PAGE ROUTES
  // ============================================================================

  // Dashboard HTML route (main dashboard with room cards)
  router.get('/', async (req, res) => {
    await renderPluginTemplate('evohome', 'dashboard', 'EvoHome Dashboard', req, res);
  });

  // Override Control HTML route
  router.get('/override-control', async (req, res) => {
    await renderPluginTemplate('evohome', 'override-control', 'Override Control', req, res);
  });

  // Scheduler HTML route
  router.get('/scheduler', async (req, res) => {
    await renderPluginTemplate('evohome', 'scheduler', 'EvoHome Scheduler', req, res);
  });

  // Status HTML route
  router.get('/status', async (req, res) => {
    await renderPluginTemplate('evohome', 'status', 'Polling Status', req, res);
  });

  // Settings HTML route
  router.get('/settings', async (req, res) => {
    await renderPluginTemplate('evohome', 'settings', 'EvoHome Settings', req, res);
  });

  // ============================================================================
  // API ENDPOINTS - Status & Monitoring
  // ============================================================================

  /**
   * GET /api/status
   * Returns current system status, polling operations, API statistics, and last check result
   * NOTE: Devices are freshly read from cache to reflect optimistic updates
   */
  router.get('/api/status', (req, res) => {
    // Get fresh devices from cache (includes optimistic updates)
    const cachedDevices = services.deviceCache.getDevices();
    let lastResult = state.lastResult;
    
    // If we have cached devices, rebuild the device details from cache
    if (lastResult && cachedDevices) {
      lastResult = {
        ...lastResult,
        devices: cachedDevices.map((device: any) => services.zoneService.getDeviceDetails(device))
      };
    }
    
    res.json({
      lastResult,
      stats: state.stats,
      apiStats: state.apiStats,
      pollingStatus: state.pollingStatus,
      isRunning: state.isRunning,
      nextRunTime: state.nextRunTime,
    });
  });

  /**
   * GET /api/polling-status
   * Returns detailed polling status for all operations
   */
  router.get('/api/polling-status', (req, res) => {
    res.json(state.pollingStatus);
  });

  // ============================================================================
  // API ENDPOINTS - Configuration
  // ============================================================================

  /**
   * GET /api/config
   * Returns the current configuration (for settings UI)
   * 
   * @route GET /api/config
   */
  router.get('/api/config', asyncHandler(async (req, res) => {
    const configManager = getConfigManager();
    const config = await configManager.getConfig<Config>('evohome');
    sendSuccess(res, config || {});
  }));

  /**
   * GET /api/schema
   * Returns the configuration schema for UI generation
   * 
   * @route GET /api/schema
   */
  router.get('/api/schema', asyncHandler(async (req, res) => {
    sendSuccess(res, CONFIG_SCHEMA);
  }));

  /**
   * POST /api/config
   * Updates override rules configuration
   * 
   * @route POST /api/config
   */
  router.post('/api/config', asyncHandler(async (req, res) => {
    const config: Config = req.body;
    const configManager = getConfigManager();
    await configManager.saveConfig('evohome', config);
    
    // Reload configuration into all services so changes take effect immediately
    await state.reloadConfig();
    
    sendSuccess(res, {}, 'Configuration updated successfully');
  }));

  /**
   * POST /api/settings
   * Updates credentials and settings, restarts authentication and polling
   * 
   * @route POST /api/settings
   */
  router.post('/api/settings', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['username', 'password', 'dhwSetTemp', 'boostTemp', 'zoneStatus', 'overrideReset', 'scheduleRefresh']);
    
    const configManager = getConfigManager();
    const currentConfig = await configManager.getConfig<Config>('evohome');
    const updatedConfig: Config = {
      ...(currentConfig || {}),
      credentials: {
        username: req.body.username,
        password: req.body.password,
      },
      settings: {
        dhwSetTemp: parseFloatSafe(req.body.dhwSetTemp, 50, 40, 70),
        boostTemp: parseFloatSafe(req.body.boostTemp, 1.5, 0.5, 3.0),
      },
      polling: {
        zoneStatus: parseIntSafe(req.body.zoneStatus, 5, 1, 5),
        overrideReset: parseIntSafe(req.body.overrideReset, 5, 5, 15),
        scheduleRefresh: parseIntSafe(req.body.scheduleRefresh, 30, 30, 60),
      },
      overrideRules: currentConfig?.overrideRules || [],
    };
    
    await configManager.saveConfig('evohome', updatedConfig);

    // Reload configuration into all services
    await state.reloadConfig();

    // Check if credentials actually changed (if we had a previous config)
    const credentialsChanged = currentConfig && (
      currentConfig.credentials.username !== updatedConfig.credentials.username ||
      currentConfig.credentials.password !== updatedConfig.credentials.password
    );

    // Check if polling intervals changed (if we had a previous config)
    const pollingChanged = currentConfig && (
      currentConfig.polling.zoneStatus !== updatedConfig.polling.zoneStatus ||
      currentConfig.polling.overrideReset !== updatedConfig.polling.overrideReset ||
      currentConfig.polling.scheduleRefresh !== updatedConfig.polling.scheduleRefresh
    );

    if (credentialsChanged) {
      // Credentials changed - need full stop/restart with re-auth
      await writeLog('Credentials changed - stopping scheduler and clearing auth cache...', 'INFO');
      state.stop();
      services.authManager.clearSessions();

      await writeLog('Re-authenticating and starting scheduler with updated configuration...', 'INFO');
      state.start();

      sendSuccess(res, {}, 'Settings saved successfully. Re-authenticating and restarting scheduler...');
    } else if (pollingChanged) {
      // Only polling intervals changed - update them smartly without full restart
      await writeLog('Polling intervals changed - updating intelligently...', 'INFO');
      state.updatePollingIntervals({
        zoneStatus: updatedConfig.polling.zoneStatus,
        overrideReset: updatedConfig.polling.overrideReset,
        scheduleRefresh: updatedConfig.polling.scheduleRefresh,
      });

      sendSuccess(res, {}, 'Settings saved successfully. Polling intervals updated.');
    } else {
      // Only settings changed (dhwSetTemp, boostTemp) - no restart needed
      sendSuccess(res, {}, 'Settings saved successfully. No restart required.');
    }
  }));

  // ============================================================================
  // API ENDPOINTS - Schedules
  // ============================================================================

  /**
   * GET /api/schedules
   * Returns schedules for all zones
   * 
   * @route GET /api/schedules
   */
  router.get('/api/schedules', asyncHandler(async (req, res) => {
    sendSuccess(res, {
      schedules: state.zoneSchedules,
      lastUpdate: state.pollingStatus.scheduleRefresh.lastPoll,
    });
  }));

  /**
   * POST /api/schedules
   * Saves schedules for all zones (TODO: implement actual API save)
   * 
   * @route POST /api/schedules
   */
  router.post('/api/schedules', asyncHandler(async (req, res) => {
    // TODO: Implement schedule saving to EvoHome API
    const schedules = req.body;
    sendSuccess(res, {}, 'Schedules saved successfully (mock implementation)');
  }));

  // ============================================================================
  // API ENDPOINTS - Boost/Override Operations
  // ============================================================================

  /**
   * POST /api/boost/zone
   * Boosts a temperature zone by increasing setpoint by configured boost amount for 1 hour
   * 
   * @route POST /api/boost/zone
   */
  router.post('/api/boost/zone', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['deviceId', 'currentTemp']);
    
    const deviceId = parseIntSafe(req.body.deviceId, 0);
    const currentTemp = parseFloatSafe(req.body.currentTemp, 20.0);
    const configManager = getConfigManager();
    const config = await configManager.getConfig<Config>('evohome');
    const boostTemp = currentTemp + (config?.settings.boostTemp || 1.5);
    
    await services.v2Api.setZoneTemperatureOverrideWithRetry(deviceId, boostTemp, 60);

    // Optimistically update cached device state
    state.updateCachedDeviceState(deviceId, boostTemp, 'Temporary');
    const updatedDevice = state.getCachedDeviceState(deviceId);

    sendSuccess(res, { device: updatedDevice }, `Zone boosted to ${boostTemp}°C for 1 hour`);
  }));

  /**
   * POST /api/boost/cancel
   * Cancels a temperature zone boost (resets to schedule)
   * 
   * @route POST /api/boost/cancel
   */
  router.post('/api/boost/cancel', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['deviceId']);
    
    const deviceId = parseIntSafe(req.body.deviceId, 0);
    await services.v2Api.cancelZoneOverrideWithRetry(deviceId);

    // Optimistically update cached device state
    state.updateCachedDeviceState(deviceId, 0.0, 'Scheduled');
    const updatedDevice = state.getCachedDeviceState(deviceId);

    sendSuccess(res, { device: updatedDevice }, 'Boost canceled, zone reset to schedule');
  }));

  /**
   * POST /api/boost/dhw
   * Boosts DHW by turning it ON for 1 hour
   * 
   * @route POST /api/boost/dhw
   */
  router.post('/api/boost/dhw', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['deviceId']);
    
    const deviceId = parseIntSafe(req.body.deviceId, 0);
    await services.v2Api.setDHWStateOverrideWithRetry(deviceId, 'On', 60);

    // Optimistically update cached DHW state
    state.updateCachedDHWState(deviceId, 'DHWOn', 'Temporary');

    sendSuccess(res, {}, 'DHW boosted to ON for 1 hour');
  }));

  /**
   * POST /api/boost/dhw/cancel
   * Cancels DHW override (resets to schedule)
   * 
   * @route POST /api/boost/dhw/cancel
   */
  router.post('/api/boost/dhw/cancel', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['deviceId']);
    
    const deviceId = parseIntSafe(req.body.deviceId, 0);
    await services.v2Api.cancelZoneOverrideWithRetry(deviceId, undefined, true); // true = isDHW

    // Optimistically update cached DHW state
    // Note: We set to 'DHWOff' as default when canceling, but API will return actual scheduled state
    state.updateCachedDHWState(deviceId, 'DHWOff', 'Scheduled');

    sendSuccess(res, {}, 'DHW override canceled, reset to schedule');
  }));

  // ============================================================================
  // API ENDPOINTS - Operations
  // ============================================================================

  /**
   * POST /api/run
   * Manually triggers a zone status check
   * 
   * @route POST /api/run
   */
  router.post('/api/run', asyncHandler(async (req, res) => {
    const result = await state.performCheck(true);
    res.json(result);
  }));

  /**
   * POST /api/test
   * Tests connection with temporary credentials (without saving)
   * 
   * @route POST /api/test
   */
  router.post('/api/test', asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['username', 'password', 'dhwSetTemp', 'boostTemp', 'zoneStatus', 'overrideReset', 'scheduleRefresh']);

    // Create temporary config for testing
    const testConfig: Config = {
      credentials: {
        username: req.body.username,
        password: req.body.password,
      },
      settings: {
        dhwSetTemp: parseFloatSafe(req.body.dhwSetTemp, 50, 40, 70),
        boostTemp: parseFloatSafe(req.body.boostTemp, 1.5, 0.5, 3.0),
      },
      polling: {
        zoneStatus: parseIntSafe(req.body.zoneStatus, 5, 1, 5),
        overrideReset: parseIntSafe(req.body.overrideReset, 5, 5, 15),
        scheduleRefresh: parseIntSafe(req.body.scheduleRefresh, 30, 30, 60),
      },
      overrideRules: [], // Not needed for connection test
    };

    // Create temporary instances for testing
    const testAuthManager = new AuthManager();
    const testV2Api = new V2ApiClient(testAuthManager, () => testConfig);
    const testZoneService = new ZoneService(testV2Api, testConfig);

    // Run check with temporary service
    const result = await testZoneService.checkZoneStatus();
    res.json(result);
  }));

  return router;
}
