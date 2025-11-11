/**
 * Configuration Management System
 * 
 * Centralized configuration storage with:
 * - Database backend (SQLite with libsql)
 * - Field-level encryption (AES-256-GCM)
 * - Type-safe operations
 * - Schema validation
 * - In-memory caching
 */

// Main exports
export { ConfigManager, getConfigManager, resetConfigManager } from './config-manager.js';
export type { ConfigManagerOptions } from './config-manager.js';

// Encryption
export { EncryptionService, getEncryptionService } from './encryption.js';

// Database adapters
export { BaseAdapter } from './adapters/base-adapter.js';
export { SQLiteAdapter } from './adapters/sqlite-adapter.js';
export { MemoryAdapter } from './adapters/memory-adapter.js';

// Schema
export * from './schema.js';

// Types
export type {
  DatabaseConfig,
  SaveConfigOptions,
  PluginConfigSchema,
  ConfigValidationSchema,
  ValidationRule,
  ConfigMetadata,
  EncryptedValue,
  ConfigChangeEvent,
} from './types.js';
