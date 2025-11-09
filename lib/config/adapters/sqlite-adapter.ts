/**
 * SQLite Adapter
 * 
 * Database adapter for SQLite using libsql client.
 * Provides native encryption at rest support.
 */

import { createClient } from '@libsql/client';
import type { Client, ResultSet } from '@libsql/client';
import { BaseAdapter } from './base-adapter.js';
import type { PluginConfig, NewPluginConfig } from '../schema.js';
import type { DatabaseConfig } from '../types.js';

export class SQLiteAdapter extends BaseAdapter {
  private client: Client | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to SQLite database
   */
  async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    try {
      // Create libsql client
      this.client = createClient({
        url: this.config.url || `file:${this.config.path}`,
        authToken: this.config.authToken,
      });

      // Test connection
      await this.client.execute('SELECT 1');
      
      // Run migrations to ensure tables exist
      await this.runMigrations();
    } catch (error) {
      this.client = null;
      throw new Error(`Failed to connect to SQLite database: ${error}`);
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Get configuration for a plugin
   */
  async getConfig(pluginName: string): Promise<PluginConfig | undefined> {
    this.ensureConnected();

    const result = await this.client!.execute({
      sql: 'SELECT * FROM plugin_configs WHERE plugin_name = ?',
      args: [pluginName],
    });

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.mapRowToConfig(result.rows[0]);
  }

  /**
   * Save or update configuration
   */
  async saveConfig(
    pluginName: string,
    configData: string,
    schemaVersion: number = 1
  ): Promise<PluginConfig> {
    this.ensureConnected();

    const now = new Date().toISOString();
    
    // Check if config exists
    const existing = await this.getConfig(pluginName);

    if (existing) {
      // Update existing
      await this.client!.execute({
        sql: `UPDATE plugin_configs 
              SET config_data = ?, schema_version = ?, updated_at = ?
              WHERE plugin_name = ?`,
        args: [configData, schemaVersion, now, pluginName],
      });

      return (await this.getConfig(pluginName))!;
    } else {
      // Insert new
      const result = await this.client!.execute({
        sql: `INSERT INTO plugin_configs (plugin_name, config_data, schema_version, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
              RETURNING *`,
        args: [pluginName, configData, schemaVersion, now, now],
      });

      return this.mapRowToConfig(result.rows[0]);
    }
  }

  /**
   * Delete configuration
   */
  async deleteConfig(pluginName: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client!.execute({
      sql: 'DELETE FROM plugin_configs WHERE plugin_name = ?',
      args: [pluginName],
    });

    return result.rowsAffected > 0;
  }

  /**
   * List all plugins
   */
  async listPlugins(): Promise<PluginConfig[]> {
    this.ensureConnected();

    const result = await this.client!.execute(
      'SELECT * FROM plugin_configs ORDER BY plugin_name'
    );

    return result.rows.map(row => this.mapRowToConfig(row));
  }

  /**
   * Check if plugin has config
   */
  async hasConfig(pluginName: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client!.execute({
      sql: 'SELECT 1 FROM plugin_configs WHERE plugin_name = ?',
      args: [pluginName],
    });

    return result.rows.length > 0;
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(pluginName: string): Promise<Date | undefined> {
    this.ensureConnected();

    const result = await this.client!.execute({
      sql: 'SELECT updated_at FROM plugin_configs WHERE plugin_name = ?',
      args: [pluginName],
    });

    if (result.rows.length === 0) {
      return undefined;
    }

    return new Date(result.rows[0].updated_at as string);
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    this.ensureConnected();

    // Create plugin_configs table
    await this.client!.execute(`
      CREATE TABLE IF NOT EXISTS plugin_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plugin_name TEXT NOT NULL UNIQUE,
        schema_version INTEGER NOT NULL DEFAULT 1,
        config_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create encryption_keys table
    await this.client!.execute(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id TEXT NOT NULL UNIQUE,
        encrypted_key TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create config_audit_log table
    await this.client!.execute(`
      CREATE TABLE IF NOT EXISTS config_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plugin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        changed_fields TEXT,
        changed_by TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    await this.client!.execute(`
      CREATE INDEX IF NOT EXISTS idx_plugin_configs_name 
      ON plugin_configs(plugin_name)
    `);

    await this.client!.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_plugin 
      ON config_audit_log(plugin_name, timestamp)
    `);
  }

  /**
   * Map database row to PluginConfig
   */
  private mapRowToConfig(row: any): PluginConfig {
    return {
      id: row.id as number,
      pluginName: row.plugin_name as string,
      schemaVersion: row.schema_version as number,
      configData: row.config_data as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Ensure database is connected
   */
  private ensureConnected(): void {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
}
