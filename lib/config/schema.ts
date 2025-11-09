/**
 * Database Schema for Configuration Management
 * 
 * Defines the structure for storing plugin configurations with encryption support.
 * Uses Drizzle ORM for type-safe database operations.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Plugin Configurations Table
 * 
 * Stores encrypted configuration data for each plugin.
 * One row per plugin, identified by plugin_name.
 */
export const pluginConfigs = sqliteTable('plugin_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  /** Unique plugin identifier (e.g., 'evohome', 'tempmonitor') */
  pluginName: text('plugin_name').notNull().unique(),
  
  /** Schema version for migration tracking */
  schemaVersion: integer('schema_version').notNull().default(1),
  
  /** Encrypted configuration JSON blob */
  configData: text('config_data').notNull(),
  
  /** Timestamp when config was created */
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  
  /** Timestamp when config was last updated */
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Encryption Keys Table
 * 
 * Manages encryption keys for key rotation support.
 * The active key is used for new encryptions.
 */
export const encryptionKeys = sqliteTable('encryption_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  /** Unique key identifier */
  keyId: text('key_id').notNull().unique(),
  
  /** Encrypted master key (encrypted with system key) */
  encryptedKey: text('encrypted_key').notNull(),
  
  /** Whether this key is currently active */
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  
  /** Timestamp when key was created */
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Configuration Audit Log Table
 * 
 * Tracks all configuration changes for audit purposes.
 * Future enhancement for compliance and debugging.
 */
export const configAuditLog = sqliteTable('config_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  /** Plugin that was modified */
  pluginName: text('plugin_name').notNull(),
  
  /** Action performed: CREATE, UPDATE, DELETE */
  action: text('action').notNull(),
  
  /** JSON array of field names that changed */
  changedFields: text('changed_fields'),
  
  /** User who made the change (future: auth system) */
  changedBy: text('changed_by'),
  
  /** Timestamp of change */
  timestamp: text('timestamp')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Export types for TypeScript
export type PluginConfig = typeof pluginConfigs.$inferSelect;
export type NewPluginConfig = typeof pluginConfigs.$inferInsert;
export type EncryptionKey = typeof encryptionKeys.$inferSelect;
export type NewEncryptionKey = typeof encryptionKeys.$inferInsert;
export type ConfigAuditEntry = typeof configAuditLog.$inferSelect;
export type NewConfigAuditEntry = typeof configAuditLog.$inferInsert;
