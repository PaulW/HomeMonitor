/**
 * Configuration Manager
 * 
 * Singleton for managing plugin configuration
 */

import * as fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import type { Config } from './types/config.types.js';
import { getDefaultConfig } from './config-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Path to plugin configuration file */
const CONFIG_FILE = join(__dirname, 'config.json');

/**
 * Default configuration
 * Generated from schema to ensure consistency
 */
const DEFAULT_CONFIG: Config = getDefaultConfig();

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config = DEFAULT_CONFIG;

  private constructor() {}

  /**
   * Gets the singleton instance
   * @returns ConfigManager instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Loads configuration from config.json file
   * @returns Loaded configuration object
   */
  async loadConfig(): Promise<Config> {
    try {
      const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(configContent);
      return this.config;
    } catch (error) {
      // Config doesn't exist, return default config
      this.config = { ...DEFAULT_CONFIG };
      return this.config;
    }
  }

  /**
   * Saves configuration to config.json file
   * @param newConfig - Configuration object to save
   */
  async saveConfig(newConfig: Config): Promise<void> {
    this.config = newConfig;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
  }

  /**
   * Gets the current configuration
   * @returns Current config object
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Updates the configuration (used by services)
   * @param newConfig - New configuration
   */
  setConfig(newConfig: Config): void {
    this.config = newConfig;
  }
}
