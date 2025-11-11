/**
 * Plugin Loader for Home Monitor
 * 
 * Provides auto-discovery and lifecycle management for plugins.
 * Scans the plugins directory, loads plugin modules, and manages their
 * initialization, startup, and shutdown.
 * 
 * Plugin Discovery:
 * - Scans lib/plugins/ directory
 * - Looks for index.js in each subdirectory
 * - Imports and validates plugin exports
 * 
 * Plugin Lifecycle:
 * 1. Discovery - Find plugin directories
 * 2. Import - Load plugin module
 * 3. Validation - Check Plugin interface compliance
 * 4. Init - Call plugin.init()
 * 5. Start - Call plugin.start() (optional)
 * 6. Stop - Call plugin.stop() on shutdown (optional)
 * 
 * @module plugin-loader
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { Plugin } from './plugin-interface.js';
import { writeLog } from './logger.js';

/**
 * Plugin loader that auto-discovers and manages plugins
 */
export class PluginLoader {
  /** Map of loaded plugins by their ID */
  private plugins: Map<string, Plugin> = new Map();
  
  /** Absolute path to the plugins directory */
  private pluginsDir: string;

  /**
   * Creates a new PluginLoader instance
   * 
   * @param pluginsDir - Absolute path to directory containing plugin folders
   */
  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
  }

  /**
   * Discovers and loads all plugins from the plugins directory
   * 
   * Process:
   * 1. Scans pluginsDir for subdirectories
   * 2. For each directory, attempts to import index.js
   * 3. Validates plugin exports match Plugin interface
   * 4. Calls plugin.init() to initialize
   * 5. Stores validated plugins in internal map
   * 
   * Failed plugin loads are logged but don't stop the process,
   * allowing partial loading if some plugins have errors.
   * 
   * @throws Logs errors to console but doesn't throw exceptions
   */
  async loadPlugins(): Promise<void> {
    try {
      const pluginDirs = readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const pluginDir of pluginDirs) {
        try {
          const pluginPath = join(this.pluginsDir, pluginDir, 'index.js');
          const pluginModule = await import(pluginPath);
          const plugin: Plugin = pluginModule.default || pluginModule.plugin;

          if (!plugin || !plugin.metadata) {
            writeLog(`Plugin in ${pluginDir} does not export a valid Plugin`, 'server', 'WARNING');
            continue;
          }

          await plugin.init();
          this.plugins.set(plugin.metadata.id, plugin);
          writeLog(`Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`, 'server', 'INFO');
        } catch (error) {
          writeLog(`Failed to load plugin from ${pluginDir}: ${error}`, 'server', 'ERROR');
        }
      }
    } catch (error) {
      writeLog(`Failed to load plugins: ${error}`, 'server', 'ERROR');
    }
  }

  /**
   * Retrieves a specific plugin by its ID
   * 
   * @param id - Unique plugin identifier from plugin.metadata.id
   * @returns Plugin instance if found, undefined otherwise
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Gets all loaded plugins as an array
   * 
   * @returns Array of all loaded Plugin instances
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Starts all loaded plugins that implement the start() method
   * 
   * Calls plugin.start() for each plugin sequentially.
   * Errors in individual plugins are logged but don't stop other plugins.
   * This is typically called after all routes are registered.
   * 
   * @example
   * ```typescript
   * await pluginLoader.loadPlugins();
   * // ... register routes ...
   * await pluginLoader.startAll();
   * ```
   */
  async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.start) {
        try {
          await plugin.start();
          writeLog(`Started plugin: ${plugin.metadata.name}`, 'server', 'INFO');
        } catch (error) {
          writeLog(`Failed to start plugin ${plugin.metadata.name}: ${error}`, 'server', 'ERROR');
        }
      }
    }
  }

  /**
   * Stops all loaded plugins that implement the stop() method
   * 
   * Calls plugin.stop() for each plugin sequentially.
   * Used during graceful shutdown (e.g., SIGINT) to allow plugins
   * to clean up resources, close connections, etc.
   * 
   * Errors in individual plugins are logged but don't prevent
   * other plugins from stopping.
   * 
   * @example
   * ```typescript
   * process.on('SIGINT', async () => {
   *   await pluginLoader.stopAll();
   *   process.exit(0);
   * });
   * ```
   */
  async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.stop) {
        try {
          await plugin.stop();
          writeLog(`Stopped plugin: ${plugin.metadata.name}`, 'server', 'INFO');
        } catch (error) {
          writeLog(`Failed to stop plugin ${plugin.metadata.name}: ${error}`, 'server', 'ERROR');
        }
      }
    }
  }

  /**
   * Dynamically loads mock data from all plugins
   * 
   * Scans each plugin directory for a mock data generator function.
   * Conventions checked (in order):
   * 1. api/mock-data.js exports generateMockConfig()
   * 2. mock-data.js exports generateMockConfig()
   * 
   * This is used for HM_MOCK_MODE to pre-populate the MemoryAdapter
   * with realistic plugin configurations without requiring manual setup.
   * 
   * @returns Record mapping plugin IDs to their mock configurations
   * 
   * @example
   * ```typescript
   * const mockData = await pluginLoader.loadMockData();
   * // { evohome: {...}, tempmonitor: {...} }
   * ```
   */
  async loadMockData(): Promise<Record<string, any>> {
    const mockData: Record<string, any> = {};

    try {
      const pluginDirs = readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const pluginDir of pluginDirs) {
        try {
          // Try standard locations for mock data generator
          const possiblePaths = [
            join(this.pluginsDir, pluginDir, 'api', 'mock-data.js'),
            join(this.pluginsDir, pluginDir, 'mock-data.js'),
          ];

          let mockDataModule = null;
          for (const path of possiblePaths) {
            try {
              mockDataModule = await import(path);
              break;
            } catch {
              // Try next path
            }
          }

          if (mockDataModule && typeof mockDataModule.generateMockConfig === 'function') {
            mockData[pluginDir] = mockDataModule.generateMockConfig();
            await writeLog(`Loaded mock data for plugin: ${pluginDir}`, 'server', 'INFO');
          }
        } catch (error) {
          // Plugin doesn't have mock data - that's okay
          await writeLog(`No mock data found for plugin ${pluginDir} (optional)`, 'server', 'DEBUG');
        }
      }
    } catch (error) {
      await writeLog(`Failed to load mock data: ${error}`, 'server', 'ERROR');
    }

    return mockData;
  }
}
