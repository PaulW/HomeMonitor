/**
 * Base Adapter Interface
 * 
 * Abstract base class for database adapters.
 * Defines the contract that all database adapters must implement.
 */

import type { PluginConfig, NewPluginConfig } from '../schema.js';

export abstract class BaseAdapter {
  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if database is connected
   */
  abstract isConnected(): boolean;

  /**
   * Get configuration for a plugin
   * @param pluginName - Name of the plugin
   * @returns Plugin configuration or undefined if not found
   */
  abstract getConfig(pluginName: string): Promise<PluginConfig | undefined>;

  /**
   * Save/update configuration for a plugin
   * @param pluginName - Name of the plugin
   * @param configData - Configuration data (JSON string)
   * @param schemaVersion - Schema version
   * @returns The saved configuration
   */
  abstract saveConfig(
    pluginName: string,
    configData: string,
    schemaVersion: number
  ): Promise<PluginConfig>;

  /**
   * Delete configuration for a plugin
   * @param pluginName - Name of the plugin
   * @returns true if deleted, false if not found
   */
  abstract deleteConfig(pluginName: string): Promise<boolean>;

  /**
   * List all configured plugins
   * @returns Array of plugin configurations
   */
  abstract listPlugins(): Promise<PluginConfig[]>;

  /**
   * Check if a plugin has configuration
   * @param pluginName - Name of the plugin
   */
  abstract hasConfig(pluginName: string): Promise<boolean>;

  /**
   * Run migrations (create tables, etc.)
   */
  abstract runMigrations(): Promise<void>;

  /**
   * Get the last updated timestamp for a plugin
   * @param pluginName - Name of the plugin
   */
  abstract getLastUpdated(pluginName: string): Promise<Date | undefined>;
}
