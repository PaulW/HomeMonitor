/**
 * Memory Adapter
 * 
 * In-memory database adapter for development and testing.
 * Provides same interface as SQLite adapter but with no persistence.
 * 
 * Used when HM_MOCK_MODE=true for local UI development.
 */

import { BaseAdapter } from './base-adapter.js';
import type { PluginConfig, NewPluginConfig } from '../schema.js';

interface MemoryAdapterOptions {
  /** Initial mock data to load (pluginName -> config data) */
  mockData?: Record<string, any>;
  /** Enable logging */
  verbose?: boolean;
}

/**
 * In-Memory Database Adapter
 * 
 * Stores all configuration in memory - no persistence to disk.
 * Perfect for local development and testing without needing a database.
 */
export class MemoryAdapter extends BaseAdapter {
  private store: Map<string, PluginConfig> = new Map();
  private connected: boolean = false;
  private options: MemoryAdapterOptions;
  private idCounter: number = 1;

  constructor(options: MemoryAdapterOptions = {}) {
    super();
    this.options = {
      verbose: false,
      ...options,
    };
  }

  /**
   * Connect to the "database" (load mock data into memory)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.log('🎭 MemoryAdapter: Initializing in-memory storage');

    // Load mock data if provided
    if (this.options.mockData) {
      for (const [pluginName, configData] of Object.entries(this.options.mockData)) {
        const now = new Date().toISOString();
        const config: PluginConfig = {
          id: this.idCounter++,
          pluginName,
          configData: JSON.stringify(configData),
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        
        this.store.set(pluginName, config);
        this.log(`  ✓ Loaded mock data for: ${pluginName}`);
      }
    }

    this.connected = true;
    this.log(`🎭 MemoryAdapter: Ready (${this.store.size} plugin(s) configured)`);
  }

  /**
   * Disconnect from the "database"
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.log('🎭 MemoryAdapter: Disconnecting (data will be lost)');
    this.store.clear();
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get configuration for a plugin
   */
  async getConfig(pluginName: string): Promise<PluginConfig | undefined> {
    this.ensureConnected();
    return this.store.get(pluginName);
  }

  /**
   * Save/update configuration for a plugin
   */
  async saveConfig(
    pluginName: string,
    configData: string,
    schemaVersion: number
  ): Promise<PluginConfig> {
    this.ensureConnected();

    const existing = this.store.get(pluginName);
    const now = new Date().toISOString();

    const config: PluginConfig = {
      id: existing?.id || this.idCounter++,
      pluginName,
      configData,
      schemaVersion,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.store.set(pluginName, config);
    this.log(`🎭 MemoryAdapter: Saved config for ${pluginName} (in-memory only)`);

    return config;
  }

  /**
   * Delete configuration for a plugin
   */
  async deleteConfig(pluginName: string): Promise<boolean> {
    this.ensureConnected();
    
    const existed = this.store.has(pluginName);
    this.store.delete(pluginName);
    
    if (existed) {
      this.log(`🎭 MemoryAdapter: Deleted config for ${pluginName}`);
    }
    
    return existed;
  }

  /**
   * List all configured plugins
   */
  async listPlugins(): Promise<PluginConfig[]> {
    this.ensureConnected();
    return Array.from(this.store.values());
  }

  /**
   * Check if a plugin has configuration
   */
  async hasConfig(pluginName: string): Promise<boolean> {
    this.ensureConnected();
    return this.store.has(pluginName);
  }

  /**
   * Run migrations (no-op for memory adapter)
   */
  async runMigrations(): Promise<void> {
    this.log('🎭 MemoryAdapter: Migrations not needed (in-memory storage)');
  }

  /**
   * Get the last updated timestamp for a plugin
   */
  async getLastUpdated(pluginName: string): Promise<Date | undefined> {
    this.ensureConnected();
    const config = this.store.get(pluginName);
    return config?.updatedAt ? new Date(config.updatedAt) : undefined;
  }

  /**
   * Ensure adapter is connected
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('MemoryAdapter: Not connected. Call connect() first.');
    }
  }

  /**
   * Log message if verbose enabled
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(message);
    }
  }
}
