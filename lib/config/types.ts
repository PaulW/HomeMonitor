/**
 * Configuration Management Types
 * 
 * Type definitions for the centralized configuration system.
 */

/**
 * Database adapter configuration
 */
export interface DatabaseConfig {
  /** Database type */
  type: 'sqlite' | 'postgres' | 'mysql';
  
  /** Connection string or file path */
  url?: string;
  
  /** SQLite file path (for type: 'sqlite') */
  path?: string;
  
  /** Authentication token (for libsql/Turso) */
  authToken?: string;
  
  /** Enable encryption at rest (libsql feature) */
  encryptionKey?: string;
}

/**
 * Configuration save options
 */
export interface SaveConfigOptions {
  /** List of field paths to encrypt (e.g., ['credentials.password', 'api.apiKey']) */
  sensitiveFields?: string[];
  
  /** Schema version for migration tracking */
  schemaVersion?: number;
  
  /** Skip validation */
  skipValidation?: boolean;
}

/**
 * Configuration validation schema
 */
export interface ConfigValidationSchema {
  /** Schema version */
  version: number;
  
  /** Fields that should be encrypted */
  sensitiveFields: string[];
  
  /** Field validation rules */
  validation?: Record<string, ValidationRule>;
}

/**
 * Field validation rule
 */
export interface ValidationRule {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  format?: 'email' | 'url' | 'uuid';
  enum?: any[];
}

/**
 * Configuration manager initialization options
 */
export interface ConfigManagerOptions {
  /** Database configuration */
  database: DatabaseConfig;
  
  /** Master encryption key (from environment variable) */
  masterKey?: string;
  
  /** Enable audit logging */
  enableAuditLog?: boolean;
  
  /** Enable in-memory caching */
  enableCache?: boolean;
}

/**
 * Plugin configuration metadata
 */
export interface ConfigMetadata {
  /** Plugin name */
  pluginName: string;
  
  /** Schema version */
  schemaVersion: number;
  
  /** When config was created */
  createdAt: Date;
  
  /** When config was last updated */
  updatedAt: Date;
}

/**
 * Encrypted field marker
 * Used to identify encrypted values in config
 */
export interface EncryptedValue {
  /** Encryption algorithm */
  algorithm: 'AES-256-GCM';
  
  /** Initialization vector (base64) */
  iv: string;
  
  /** Encrypted data (base64) */
  data: string;
  
  /** Authentication tag (base64) */
  tag: string;
  
  /** Key ID used for encryption (for key rotation) */
  keyId: string;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  /** Plugin name */
  pluginName: string;
  
  /** Action performed */
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  
  /** Fields that changed (for UPDATE) */
  changedFields?: string[];
  
  /** Old values (for UPDATE) */
  oldValues?: Record<string, any>;
  
  /** New values (for CREATE/UPDATE) */
  newValues?: Record<string, any>;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Plugin config schema definition
 * Plugins should export this to enable validation and UI generation
 */
export interface PluginConfigSchema<T = any> {
  /** Schema version */
  version: number;
  
  /** TypeScript interface for type safety */
  interface?: T;
  
  /** Fields that contain sensitive data */
  sensitiveFields: string[];
  
  /** Validation rules for each field */
  validation: Record<string, ValidationRule>;
  
  /** Default values */
  defaults: Partial<T>;
  
  /** UI metadata (for settings page generation) */
  ui?: {
    sections?: Array<{
      title: string;
      description?: string;
      fields: string[];
    }>;
    labels?: Record<string, string>;
    descriptions?: Record<string, string>;
  };
}
