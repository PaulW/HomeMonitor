/**
 * Configuration Manager
 * 
 * Centralized configuration management system with:
 * - Database storage (SQLite with libsql)
 * - Field-level encryption for sensitive data
 * - In-memory caching
 * - Type-safe operations
 * - Schema validation
 */

import path from 'path';
import { BaseAdapter } from './adapters/base-adapter.js';
import { SQLiteAdapter } from './adapters/sqlite-adapter.js';
import { MemoryAdapter } from './adapters/memory-adapter.js';
import { getEncryptionService, EncryptionService } from './encryption.js';
import type {
  DatabaseConfig,
  SaveConfigOptions,
  PluginConfigSchema,
  ConfigValidationSchema,
} from './types.js';
import type { PluginConfig } from './schema.js';

/**
 * Configuration Manager Options
 */
export interface ConfigManagerOptions {
  /** Database configuration */
  database?: DatabaseConfig;
  /** Master encryption key */
  encryptionKey?: string;
  /** Enable in-memory caching */
  enableCache?: boolean;
  /** Data directory path */
  dataDir?: string;
  /** Enable mock mode (in-memory storage, no persistence) */
  mockMode?: boolean;
  /** Initial mock data for plugins (pluginName -> config object) */
  mockData?: Record<string, any>;
  /** Enable verbose logging for mock mode */
  verbose?: boolean;
}

/**
 * Configuration Manager
 */
export class ConfigManager {
  private adapter: BaseAdapter;
  private encryption: EncryptionService;
  private cache: Map<string, any> = new Map();
  private schemas: Map<string, PluginConfigSchema<any>> = new Map();
  private enableCache: boolean;
  private initialized: boolean = false;

  constructor(options: ConfigManagerOptions = {}) {
    const {
      database,
      encryptionKey,
      enableCache = true,
      dataDir = './data',
      mockMode = false,
      mockData,
      verbose = false,
    } = options;

    this.enableCache = enableCache;

    // Choose adapter based on mode
    if (mockMode) {
      // Mock mode: Use in-memory storage
      console.log('🎭 ConfigManager: Mock mode enabled (in-memory storage, no database)');
      this.adapter = new MemoryAdapter({
        mockData,
        verbose,
      });
    } else {
      // Production mode: Use SQLite database
      const dbConfig: DatabaseConfig = database || {
        type: 'sqlite',
        path: path.join(dataDir, 'home-monitor.db'),
      };

      if (dbConfig.type === 'sqlite') {
        this.adapter = new SQLiteAdapter(dbConfig);
      } else {
        throw new Error(`Unsupported database type: ${dbConfig.type}`);
      }
    }

    // Initialize encryption service
    this.encryption = getEncryptionService();
    
    // If encryption key provided, initialize now
    if (encryptionKey) {
      this.encryption.initialize(encryptionKey).catch(err => {
        console.error('Failed to initialize encryption:', err);
      });
    }
  }

  /**
   * Initialize the configuration manager
   */
  async initialize(encryptionKey?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get encryption key from parameter or environment
    const key = encryptionKey || process.env.HM_MASTER_KEY;
    if (!key) {
      throw new Error(
        'Encryption key required. Provide via parameter or HM_MASTER_KEY environment variable.'
      );
    }

    // Initialize encryption
    await this.encryption.initialize(key);

    // Connect to database
    await this.adapter.connect();

    this.initialized = true;
  }

  /**
   * Register a plugin configuration schema
   */
  registerSchema<T = any>(pluginName: string, schema: PluginConfigSchema<T>): void {
    this.schemas.set(pluginName, schema);
  }

  /**
   * Get configuration for a plugin
   */
  async getConfig<T = any>(pluginName: string): Promise<T | undefined> {
    this.ensureInitialized();

    // Check cache first
    if (this.enableCache && this.cache.has(pluginName)) {
      return this.cache.get(pluginName) as T;
    }

    // Get from database
    const dbConfig = await this.adapter.getConfig(pluginName);
    if (!dbConfig) {
      return undefined;
    }

    // Parse and decrypt config data
    let config = JSON.parse(dbConfig.configData);

    // Decrypt sensitive fields if schema is registered
    const schema = this.schemas.get(pluginName);
    if (schema && schema.sensitiveFields && schema.sensitiveFields.length > 0) {
      config = this.encryption.decryptFields(config, schema.sensitiveFields);
    }

    // Cache the decrypted config
    if (this.enableCache) {
      this.cache.set(pluginName, config);
    }

    return config as T;
  }

  /**
   * Save configuration for a plugin
   */
  async saveConfig<T = any>(
    pluginName: string,
    config: T,
    options: SaveConfigOptions = {}
  ): Promise<void> {
    this.ensureInitialized();

    const {
      sensitiveFields,
      schemaVersion = 1,
      skipValidation = false,
    } = options;

    // Get schema if registered
    const schema = this.schemas.get(pluginName);

    // Validate if schema exists and validation not skipped
    if (!skipValidation && schema) {
      this.validateConfig(config, schema);
    }

    // Determine which fields to encrypt
    const fieldsToEncrypt = sensitiveFields || schema?.sensitiveFields || [];

    // Encrypt sensitive fields
    let configToStore = config;
    if (fieldsToEncrypt.length > 0) {
      configToStore = this.encryption.encryptFields(config, fieldsToEncrypt);
    }

    // Convert to JSON
    const configData = JSON.stringify(configToStore);

    // Save to database
    await this.adapter.saveConfig(
      pluginName,
      configData,
      schemaVersion
    );

    // Update cache with decrypted version
    if (this.enableCache) {
      this.cache.set(pluginName, config);
    }
  }

  /**
   * Update partial configuration for a plugin
   */
  async updateConfig<T = any>(
    pluginName: string,
    partial: Partial<T>,
    options: SaveConfigOptions = {}
  ): Promise<void> {
    this.ensureInitialized();

    // Get existing config
    const existing = await this.getConfig<T>(pluginName);
    if (!existing) {
      throw new Error(`No configuration found for plugin: ${pluginName}`);
    }

    // Merge with partial update
    const updated = {
      ...existing,
      ...partial,
    };

    // Save updated config
    await this.saveConfig(pluginName, updated, options);
  }

  /**
   * Delete configuration for a plugin
   */
  async deleteConfig(pluginName: string): Promise<boolean> {
    this.ensureInitialized();

    // Delete from database
    const deleted = await this.adapter.deleteConfig(pluginName);

    // Remove from cache
    if (this.enableCache) {
      this.cache.delete(pluginName);
    }

    return deleted;
  }

  /**
   * Check if plugin has configuration
   */
  async hasConfig(pluginName: string): Promise<boolean> {
    this.ensureInitialized();

    // Check cache first
    if (this.enableCache && this.cache.has(pluginName)) {
      return true;
    }

    return await this.adapter.hasConfig(pluginName);
  }

  /**
   * List all configured plugins
   */
  async listConfiguredPlugins(): Promise<string[]> {
    this.ensureInitialized();

    const configs = await this.adapter.listPlugins();
    return configs.map(c => c.pluginName);
  }

  /**
   * Get last updated timestamp for a plugin
   */
  async getLastUpdated(pluginName: string): Promise<Date | undefined> {
    this.ensureInitialized();

    return await this.adapter.getLastUpdated(pluginName);
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(pluginName?: string): void {
    if (pluginName) {
      this.cache.delete(pluginName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Shutdown the configuration manager
   */
  async shutdown(): Promise<void> {
    this.clearCache();
    await this.adapter.disconnect();
    this.initialized = false;
  }

  /**
   * Validate configuration against schema
   */
  private validateConfig<T>(config: T, schema: PluginConfigSchema<T>): void {
    if (!schema.validation) {
      return; // No validation schema
    }

    const errors: string[] = [];

    for (const [fieldName, rule] of Object.entries(schema.validation)) {
      // Support nested field paths (e.g., 'credentials.username')
      const value = this.getNestedValue(config, fieldName);

      // Check required
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Field '${fieldName}' is required`);
        continue;
      }

      // Skip validation if not required and not present
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      if (rule.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.type) {
          errors.push(
            `Field '${fieldName}' must be of type ${rule.type}, got ${actualType}`
          );
        }
      }

      // String validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(
            `Field '${fieldName}' must be at least ${rule.minLength} characters`
          );
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(
            `Field '${fieldName}' must be at most ${rule.maxLength} characters`
          );
        }
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`Field '${fieldName}' does not match required pattern`);
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Field '${fieldName}' must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Field '${fieldName}' must be at most ${rule.max}`);
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(
          `Field '${fieldName}' must be one of: ${rule.enum.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.join('\n')}`
      );
    }
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'ConfigManager not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * Singleton instance
 */
let configManagerInstance: ConfigManager | null = null;

/**
 * Get the configuration manager singleton
 */
export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(options);
  }
  return configManagerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetConfigManager(): void {
  if (configManagerInstance) {
    configManagerInstance.shutdown().catch(console.error);
    configManagerInstance = null;
  }
}
