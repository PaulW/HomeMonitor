/**
 * Service Initializer
 * 
 * Centralizes initialization of all plugin services to reduce constructor complexity.
 * Creates and wires up service dependencies in the correct order.
 * 
 * @module plugins/evohome/utils/service-initializer
 */

import { AuthManager } from '../api/auth-manager.js';
import { V1ApiClient } from '../api/v1-api.js';
import { V2ApiClient } from '../api/v2-api.js';
import { ZoneService } from '../services/zone-service.js';
import { OverrideService } from '../services/override-service.js';
import { ScheduleService } from '../services/schedule-service.js';
import { TaskScheduler } from '../../../lib/task-scheduler.js';
import { StatsTracker } from '../../../lib/stats-tracker.js';
import { ApiStatsTracker } from '../services/api-stats-tracker.js';
import { DeviceCacheService } from '../services/device-cache-service.js';
import type { Config } from '../types/config.types.js';

/**
 * Container for all initialized services
 */
export interface ServiceContainer {
  authManager: AuthManager;
  v1Api: V1ApiClient;
  v2Api: V2ApiClient;
  zoneService: ZoneService;
  overrideService: OverrideService;
  scheduleService: ScheduleService;
  taskScheduler: TaskScheduler;
  statsTracker: StatsTracker;
  apiStatsTracker: ApiStatsTracker;
  deviceCache: DeviceCacheService;
}

/**
 * Service Initializer - Creates and wires up all plugin services
 */
export class ServiceInitializer {
  /**
   * Initializes all plugin services with proper dependency wiring
   * 
   * Services are created in dependency order:
   * 1. AuthManager
   * 2. API clients (V1, V2) - use config getter
   * 3. Business logic services (Zone, Override, Schedule) - start with empty config
   * 4. Infrastructure services (Polling, Stats, Cache)
   * 
   * @param getConfig - Function that returns current configuration
   * @returns Container with all initialized services
   * 
   * @example
   * const services = ServiceInitializer.createServices(() => this.currentConfig);
   * this.v2Api = services.v2Api;
   * this.zoneService = services.zoneService;
   */
  static createServices(getConfig: () => Config): ServiceContainer {
    // 1. Initialize infrastructure services first (needed by AuthManager)
    const apiStatsTracker = new ApiStatsTracker();
    const deviceCache = new DeviceCacheService();
    
    // 2. Initialize AuthManager with stats tracker
    const authManager = new AuthManager(apiStatsTracker);
    
    // 3. Initialize API clients with config getter function
    const v1Api = new V1ApiClient(authManager, getConfig, apiStatsTracker);
    const v2Api = new V2ApiClient(authManager, getConfig, apiStatsTracker, v1Api);
    
    // 4. Initialize business logic services with empty config (will be loaded in init())
    const emptyConfig = {} as Config;
    const zoneService = new ZoneService(v2Api, emptyConfig);
    const overrideService = new OverrideService(
      zoneService,
      v2Api,
      authManager,
      emptyConfig,
      deviceCache
    );
    const scheduleService = new ScheduleService(
      v1Api,
      v2Api,
      authManager,
      emptyConfig,
      deviceCache
    );
    
    // 5. Initialize remaining infrastructure services
    const taskScheduler = new TaskScheduler();
    const statsTracker = new StatsTracker();
    
    return {
      authManager,
      v1Api,
      v2Api,
      zoneService,
      overrideService,
      scheduleService,
      taskScheduler,
      statsTracker,
      apiStatsTracker,
      deviceCache,
    };
  }
}
