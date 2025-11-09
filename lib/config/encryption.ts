/**
 * Encryption Service
 * 
 * Handles field-level encryption/decryption for configuration data.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';
import type { EncryptedValue } from './types.js';

/**
 * Encryption prefix to identify encrypted values
 */
const ENCRYPTION_PREFIX = 'enc:v1:';

/**
 * Encryption algorithm
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Key derivation settings
 */
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32;
const IV_LENGTH = 16;

export class EncryptionService {
  private masterKey: Buffer | null = null;
  private keyId: string = 'default';
  private salt: Buffer;

  constructor() {
    // Use a fixed salt for PBKDF2 key derivation
    // This ensures consistent encryption/decryption across restarts
    // In production with key rotation, this would be stored per key
    this.salt = Buffer.from('home-monitor-config-salt-v1', 'utf8');
  }

  /**
   * Initialize encryption service with master key
   * @param masterKey - Master key from environment or config
   * @param keyId - Optional key ID for key rotation
   */
  async initialize(masterKey: string, keyId: string = 'default'): Promise<void> {
    if (!masterKey || masterKey.length < 16) {
      throw new Error('Master key must be at least 16 characters');
    }

    this.keyId = keyId;
    
    // Derive encryption key from master key using PBKDF2
    this.masterKey = await this.deriveKey(masterKey);
  }

  /**
   * Derives an encryption key from the master key using PBKDF2
   */
  private async deriveKey(masterKey: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        masterKey,
        this.salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  /**
   * Encrypts a value
   * @param value - Value to encrypt
   * @returns Encrypted string with metadata
   */
  encrypt(value: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

    // Encrypt data
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Create encrypted value object
    const encryptedObj: EncryptedValue = {
      algorithm: 'AES-256-GCM',
      iv: iv.toString('base64'),
      data: encrypted,
      tag: tag.toString('base64'),
      keyId: this.keyId,
    };

    // Return as prefixed JSON string
    return ENCRYPTION_PREFIX + JSON.stringify(encryptedObj);
  }

  /**
   * Decrypts a value
   * @param encryptedValue - Encrypted string with metadata
   * @returns Decrypted value
   */
  decrypt(encryptedValue: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    // Check for encryption prefix
    if (!encryptedValue.startsWith(ENCRYPTION_PREFIX)) {
      // Not encrypted, return as-is
      return encryptedValue;
    }

    // Parse encrypted object
    const encryptedData = JSON.parse(
      encryptedValue.substring(ENCRYPTION_PREFIX.length)
    ) as EncryptedValue;

    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    const encrypted = Buffer.from(encryptedData.data, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Checks if a value is encrypted
   */
  isEncrypted(value: any): boolean {
    return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
  }

  /**
   * Encrypts specific fields in an object
   * @param obj - Object to encrypt fields in
   * @param fieldPaths - Array of field paths (e.g., ['credentials.password', 'api.key'])
   * @returns Object with encrypted fields
   */
  encryptFields(obj: any, fieldPaths: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Deep clone to avoid mutating the original object
    const result = JSON.parse(JSON.stringify(obj));

    for (const path of fieldPaths) {
      const value = this.getNestedValue(result, path);
      
      if (value !== undefined && !this.isEncrypted(value)) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        this.setNestedValue(result, path, this.encrypt(stringValue));
      }
    }

    return result;
  }

  /**
   * Decrypts specific fields in an object
   * @param obj - Object to decrypt fields in
   * @param fieldPaths - Array of field paths
   * @returns Object with decrypted fields
   */
  decryptFields(obj: any, fieldPaths: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Deep clone to avoid mutating the original object
    const result = JSON.parse(JSON.stringify(obj));

    for (const path of fieldPaths) {
      const value = this.getNestedValue(result, path);
      
      if (value !== undefined && this.isEncrypted(value)) {
        this.setNestedValue(result, path, this.decrypt(value));
      }
    }

    return result;
  }

  /**
   * Gets a nested value from an object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Sets a nested value in an object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Gets the current key ID
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Gets the salt (for storage)
   */
  getSalt(): string {
    return this.salt.toString('base64');
  }

  /**
   * Sets the salt (for loading from storage)
   */
  setSalt(salt: string): void {
    this.salt = Buffer.from(salt, 'base64');
  }
}

/**
 * Singleton instance
 */
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Gets the encryption service singleton
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}
