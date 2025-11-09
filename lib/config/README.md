# Configuration Management System

Centralized configuration management for Home Monitor with database storage, field-level encryption, and type-safe operations.

## Features

- **Database Storage**: SQLite with libsql (native encryption at rest)
- **Field-Level Encryption**: AES-256-GCM for sensitive data
- **Type Safety**: Full TypeScript support with generics
- **Schema Validation**: Automatic validation with customizable rules
- **In-Memory Caching**: Fast access to frequently used configs
- **Multiple Backends**: SQLite now, PostgreSQL/MySQL support planned
- **Key Rotation**: Built-in support for encryption key rotation
- **Audit Trail**: Configuration change tracking (planned)

## Quick Start

### 1. Initialize ConfigManager

```typescript
import { getConfigManager } from './lib/config/index.js';

const configManager = getConfigManager({
  database: {
    type: 'sqlite',
    path: './data/home-monitor.db',
  },
  enableCache: true,
});

// Initialize with encryption key
await configManager.initialize(process.env.HM_MASTER_KEY);
```

### 2. Register Plugin Schema

```typescript
interface MyPluginConfig {
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  timeout: number;
  retries: number;
  debug: boolean;
}

configManager.registerSchema<MyPluginConfig>('my-plugin', {
  version: 1,
  
  // Fields that should be encrypted
  sensitiveFields: ['apiKey', 'password'],
  
  // Validation rules
  validation: {
    apiUrl: { type: 'string', required: true },
    apiKey: { type: 'string', required: true, minLength: 16 },
    username: { type: 'string', required: true, minLength: 3 },
    password: { type: 'string', required: true, minLength: 8 },
    timeout: { type: 'number', min: 1000, max: 60000 },
    retries: { type: 'number', min: 0, max: 10 },
    debug: { type: 'boolean' },
  },
  
  // Default values
  defaults: {
    timeout: 5000,
    retries: 3,
    debug: false,
  },
  
  // Optional UI metadata for settings pages
  ui: {
    sections: [
      {
        title: 'API Configuration',
        fields: ['apiUrl', 'apiKey'],
      },
      {
        title: 'Authentication',
        fields: ['username', 'password'],
      },
      {
        title: 'Advanced',
        fields: ['timeout', 'retries', 'debug'],
      },
    ],
    labels: {
      apiUrl: 'API URL',
      apiKey: 'API Key',
      timeout: 'Request Timeout (ms)',
    },
  },
});
```

### 3. Save Configuration

```typescript
const config: MyPluginConfig = {
  apiUrl: 'https://api.example.com',
  apiKey: 'secret-key-value',
  username: 'admin',
  password: 'super-secret',
  timeout: 10000,
  retries: 5,
  debug: false,
};

// Save with automatic encryption and validation
await configManager.saveConfig('my-plugin', config);
```

### 4. Retrieve Configuration

```typescript
// Get config (automatically decrypted)
const config = await configManager.getConfig<MyPluginConfig>('my-plugin');

if (config) {
  console.log('API URL:', config.apiUrl);
  console.log('Password:', config.password); // Decrypted automatically
}
```

### 5. Update Configuration

```typescript
// Update specific fields
await configManager.updateConfig('my-plugin', {
  timeout: 15000,
  debug: true,
});
```

### 6. Delete Configuration

```typescript
const deleted = await configManager.deleteConfig('my-plugin');
if (deleted) {
  console.log('Configuration deleted');
}
```

## API Reference

### ConfigManager

#### Methods

##### `initialize(encryptionKey?: string): Promise<void>`
Initialize the config manager. Encryption key can be provided via parameter or `HM_MASTER_KEY` environment variable.

##### `registerSchema<T>(pluginName: string, schema: PluginConfigSchema<T>): void`
Register a configuration schema for a plugin. Enables validation and defines which fields should be encrypted.

##### `getConfig<T>(pluginName: string): Promise<T | undefined>`
Retrieve configuration for a plugin. Returns undefined if not found. Sensitive fields are automatically decrypted.

##### `saveConfig<T>(pluginName: string, config: T, options?: SaveConfigOptions): Promise<void>`
Save configuration for a plugin. Validates against schema if registered. Automatically encrypts sensitive fields.

##### `updateConfig<T>(pluginName: string, partial: Partial<T>, options?: SaveConfigOptions): Promise<void>`
Update specific fields in a configuration. Merges with existing config.

##### `deleteConfig(pluginName: string): Promise<boolean>`
Delete configuration for a plugin. Returns true if deleted, false if not found.

##### `hasConfig(pluginName: string): Promise<boolean>`
Check if a plugin has configuration stored.

##### `listConfiguredPlugins(): Promise<string[]>`
Get list of all plugins with stored configurations.

##### `clearCache(pluginName?: string): void`
Clear the in-memory cache. If pluginName provided, clears only that plugin's cache.

##### `shutdown(): Promise<void>`
Shut down the config manager, clear cache, and disconnect from database.

### PluginConfigSchema<T>

```typescript
interface PluginConfigSchema<T> {
  version: number;                    // Schema version for migrations
  interface?: T;                      // TypeScript interface (for type checking)
  sensitiveFields: string[];          // Paths to fields that should be encrypted
  validation: Record<string, ValidationRule>; // Validation rules per field
  defaults: Partial<T>;               // Default values
  ui?: {                              // Optional UI metadata
    sections?: Array<{
      title: string;
      description?: string;
      fields: string[];
    }>;
    labels?: Record<string, string>;
    descriptions?: Record<string, string>;
  };
}
```

### ValidationRule

```typescript
interface ValidationRule {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;           // For numbers: minimum value
  max?: number;           // For numbers: maximum value
  minLength?: number;     // For strings: minimum length
  maxLength?: number;     // For strings: maximum length
  pattern?: RegExp;       // For strings: regex pattern
  format?: 'email' | 'url' | 'uuid'; // String format validation
  enum?: any[];           // Allowed values
}
```

## Architecture

### Database Schema

#### `plugin_configs`
Stores plugin configurations with encrypted sensitive fields.

```sql
CREATE TABLE plugin_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_name TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  config_data TEXT NOT NULL,        -- Encrypted JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### `encryption_keys`
Supports key rotation for encryption.

```sql
CREATE TABLE encryption_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id TEXT NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

#### `config_audit_log`
Tracks configuration changes (planned feature).

```sql
CREATE TABLE config_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_name TEXT NOT NULL,
  action TEXT NOT NULL,            -- CREATE/UPDATE/DELETE
  changed_fields TEXT,             -- JSON array
  changed_by TEXT,
  timestamp TEXT NOT NULL
);
```

### Encryption

Uses AES-256-GCM (authenticated encryption) with:
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Initialization Vector**: Random 16-byte IV per encryption
- **Authentication Tag**: Ensures data integrity
- **Field-Level**: Only sensitive fields encrypted, rest queryable

Encrypted values stored as JSON with prefix `enc:v1:`:
```typescript
{
  algorithm: 'AES-256-GCM',
  iv: 'base64-encoded-iv',
  data: 'base64-encoded-ciphertext',
  tag: 'base64-encoded-auth-tag',
  keyId: 'key-identifier'
}
```

### In-Memory Caching

- Configs cached after first retrieval
- Cache cleared on updates/deletes
- Can be disabled via `enableCache: false`

## Environment Variables

### `HM_MASTER_KEY`
Master encryption key. Must be at least 16 characters. Used to derive encryption keys via PBKDF2.

**Example:**
```bash
export HM_MASTER_KEY="your-secure-master-key-here"
```

**Recommendation:** Use a 32+ character random string. Store securely (e.g., secrets manager, not in git).

## Testing

Run the integration test:

```bash
npx tsx lib/config/test-config.ts
```

Tests cover:
- Initialization
- Schema registration
- Save/retrieve/update/delete operations
- Encryption/decryption round-trip
- Validation
- Caching

## Security Considerations

1. **Master Key Storage**: Never commit `HM_MASTER_KEY` to git. Use environment variables or secrets management.

2. **Database File**: Located at `data/home-monitor.db`. Excluded from git via `.gitignore`. libsql provides native encryption at rest.

3. **Key Rotation**: Supported via `keyId` field. Old keys kept in `encryption_keys` table for decrypting old values.

4. **Field-Level Encryption**: Only sensitive fields encrypted. Non-sensitive data remains queryable and debuggable.

5. **Authentication Tags**: AES-GCM provides data integrity. Tampering detected during decryption.

## Future Enhancements

- **Audit Logging**: Track who changed what and when
- **PostgreSQL/MySQL Adapters**: Support for centralized databases
- **Config Versioning**: Track config history with rollback support
- **Migration Tool**: CLI for migrating between backends
- **Web UI**: Settings page auto-generated from schema metadata
- **Config Import/Export**: Backup and restore configs
- **Access Control**: Role-based permissions for config changes

## Troubleshooting

### "Encryption service not initialized"
Make sure to call `await configManager.initialize(key)` before any operations.

### "Master key must be at least 16 characters"
Use a longer encryption key. Recommended 32+ characters.

### "Database not connected"
The adapter failed to connect. Check database path and permissions.

### "Configuration validation failed"
Review validation rules in your schema. The error message lists which fields failed validation.

## Files

```
lib/config/
├── index.ts                    # Main exports
├── config-manager.ts           # ConfigManager class
├── encryption.ts               # Encryption service
├── schema.ts                   # Drizzle ORM schema
├── types.ts                    # TypeScript interfaces
├── test-config.ts              # Integration tests
├── adapters/
│   ├── base-adapter.ts         # Abstract adapter interface
│   └── sqlite-adapter.ts       # SQLite implementation
└── migrations/
    └── (auto-generated)        # Database migrations
```

## License

Same as Home Monitor main project.
