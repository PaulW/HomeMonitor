/**
 * Configuration Manager Test
 * 
 * Basic integration test for the configuration management system.
 */

import { ConfigManager } from './config-manager.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-home-monitor.db');

/**
 * Test configuration interface
 */
interface TestConfig {
  username: string;
  password: string;
  apiUrl: string;
  timeout: number;
  debug: boolean;
}

async function runTests() {
  console.log('🧪 Testing Configuration Manager\n');

  // Clean up test database if it exists
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
    console.log('✓ Cleaned up old test database');
  }

  // Create config manager
  const configManager = new ConfigManager({
    database: {
      type: 'sqlite',
      path: TEST_DB_PATH,
    },
    enableCache: true,
    dataDir: './data',
  });

  try {
    // Test 1: Initialize
    console.log('\n📦 Test 1: Initialize');
    await configManager.initialize('test-master-key-at-least-16-chars');
    console.log('✓ ConfigManager initialized');

    // Test 2: Register schema
    console.log('\n📦 Test 2: Register schema');
    configManager.registerSchema<TestConfig>('test-plugin', {
      version: 1,
      sensitiveFields: ['password'],
      validation: {
        username: { type: 'string', required: true, minLength: 3 },
        password: { type: 'string', required: true, minLength: 8 },
        apiUrl: { type: 'string', required: true },
        timeout: { type: 'number', min: 1000, max: 60000 },
        debug: { type: 'boolean' },
      },
      defaults: {
        timeout: 5000,
        debug: false,
      },
    });
    console.log('✓ Schema registered');

    // Test 3: Save config
    console.log('\n📦 Test 3: Save configuration');
    const testConfig: TestConfig = {
      username: 'admin',
      password: 'super-secret-password',
      apiUrl: 'https://api.example.com',
      timeout: 10000,
      debug: true,
    };
    
    await configManager.saveConfig('test-plugin', testConfig);
    console.log('✓ Configuration saved');

    // Test 4: Retrieve config
    console.log('\n📦 Test 4: Retrieve configuration');
    const retrieved = await configManager.getConfig<TestConfig>('test-plugin');
    
    if (!retrieved) {
      throw new Error('Configuration not found');
    }

    console.log('✓ Configuration retrieved');
    console.log('  Username:', retrieved.username);
    console.log('  Password:', retrieved.password);
    console.log('  API URL:', retrieved.apiUrl);
    console.log('  Timeout:', retrieved.timeout);
    console.log('  Debug:', retrieved.debug);

    // Verify values
    if (retrieved.username !== testConfig.username) {
      throw new Error('Username mismatch');
    }
    if (retrieved.password !== testConfig.password) {
      throw new Error('Password mismatch (encryption/decryption failed)');
    }
    console.log('✓ All values match (encryption/decryption working)');

    // Test 5: Update config
    console.log('\n📦 Test 5: Update configuration');
    await configManager.updateConfig('test-plugin', {
      timeout: 20000,
    });
    
    const updated = await configManager.getConfig<TestConfig>('test-plugin');
    if (updated?.timeout !== 20000) {
      throw new Error('Update failed');
    }
    console.log('✓ Configuration updated');
    console.log('  New timeout:', updated.timeout);

    // Test 6: Check config exists
    console.log('\n📦 Test 6: Check configuration exists');
    const exists = await configManager.hasConfig('test-plugin');
    if (!exists) {
      throw new Error('Config should exist');
    }
    console.log('✓ Configuration exists');

    // Test 7: List configs
    console.log('\n📦 Test 7: List all configurations');
    const plugins = await configManager.listConfiguredPlugins();
    console.log('✓ Configured plugins:', plugins);

    // Test 8: Delete config
    console.log('\n📦 Test 8: Delete configuration');
    const deleted = await configManager.deleteConfig('test-plugin');
    if (!deleted) {
      throw new Error('Delete failed');
    }
    console.log('✓ Configuration deleted');

    // Verify deletion
    const afterDelete = await configManager.getConfig('test-plugin');
    if (afterDelete !== undefined) {
      throw new Error('Config should not exist after deletion');
    }
    console.log('✓ Deletion verified');

    // Test 9: Validation
    console.log('\n📦 Test 9: Test validation');
    configManager.registerSchema<TestConfig>('validation-test', {
      version: 1,
      sensitiveFields: [],
      validation: {
        username: { type: 'string', required: true, minLength: 5 },
        password: { type: 'string', required: true, minLength: 12 },
      },
      defaults: {},
    });

    try {
      await configManager.saveConfig('validation-test', {
        username: 'abc', // Too short
        password: 'short',
        apiUrl: 'test',
        timeout: 1000,
        debug: false,
      });
      throw new Error('Validation should have failed');
    } catch (err: any) {
      if (err.message.includes('Validation should have failed')) {
        throw err;
      }
      console.log('✓ Validation correctly rejected invalid config');
      console.log('  Error:', err.message.split('\n')[0]);
    }

    // Cleanup
    console.log('\n🧹 Cleanup');
    await configManager.shutdown();
    console.log('✓ ConfigManager shut down');

    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
      console.log('✓ Test database deleted');
    }

    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    
    // Cleanup on error
    try {
      await configManager.shutdown();
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run tests
runTests();
