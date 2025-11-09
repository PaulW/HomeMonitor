/**
 * API Statistics Tracker Service
 * 
 * Tracks detailed statistics for V1 and V2 API operations:
 * - Authentication requests and expirations
 * - GET/PUT request counts and success rates
 * - Timestamps for all operations
 */

/**
 * Statistics for a single API version (V1 or V2)
 */
export interface ApiStats {
  /** Authentication statistics */
  auth: {
    /** Total authentication requests made */
    totalRequests: number;
    /** Total successful authentications */
    totalSuccess: number;
    /** Total authentication failures (including rate limits, invalid credentials, network errors, etc.) */
    totalFailed: number;
    /** Total authentication expirations */
    totalExpired: number;
    /** Timestamp of last successful authentication */
    lastAuthTime: Date | null;
    /** Timestamp of last authentication failure */
    lastFailedTime: Date | null;
    /** Timestamp of last authentication expiration */
    lastExpiredTime: Date | null;
  };
  
  /** GET request statistics */
  get: {
    /** Total successful GET requests */
    success: number;
    /** Total failed GET requests */
    failed: number;
    /** Timestamp of last successful GET request */
    lastSuccessTime: Date | null;
    /** Timestamp of last failed GET request */
    lastFailedTime: Date | null;
  };
  
  /** PUT request statistics */
  put: {
    /** Total successful PUT requests */
    success: number;
    /** Total failed PUT requests */
    failed: number;
    /** Timestamp of last successful PUT request */
    lastSuccessTime: Date | null;
    /** Timestamp of last failed PUT request */
    lastFailedTime: Date | null;
  };
}

/**
 * Complete API statistics for both V1 and V2
 */
export interface ApiStatistics {
  v1: ApiStats;
  v2: ApiStats;
}

/**
 * API Statistics Tracker handles cumulative API stats
 */
export class ApiStatsTracker {
  private stats: ApiStatistics = {
    v1: this.createEmptyStats(),
    v2: this.createEmptyStats(),
  };

  /**
   * Creates empty statistics object
   */
  private createEmptyStats(): ApiStats {
    return {
      auth: {
        totalRequests: 0,
        totalSuccess: 0,
        totalFailed: 0,
        totalExpired: 0,
        lastAuthTime: null,
        lastFailedTime: null,
        lastExpiredTime: null,
      },
      get: {
        success: 0,
        failed: 0,
        lastSuccessTime: null,
        lastFailedTime: null,
      },
      put: {
        success: 0,
        failed: 0,
        lastSuccessTime: null,
        lastFailedTime: null,
      },
    };
  }

  /**
   * Get current statistics
   */
  getStats(): ApiStatistics {
    return this.stats;
  }

  /**
   * Record an authentication request
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the authentication occurred
   */
  recordAuth(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].auth.totalRequests++;
    this.stats[apiVersion].auth.totalSuccess++;
    this.stats[apiVersion].auth.lastAuthTime = timestamp;
  }

  /**
   * Record an authentication failure
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the authentication failed
   */
  recordAuthFailure(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].auth.totalRequests++;
    this.stats[apiVersion].auth.totalFailed++;
    this.stats[apiVersion].auth.lastFailedTime = timestamp;
  }

  /**
   * Record an authentication expiration
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the authentication expired
   */
  recordAuthExpired(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].auth.totalExpired++;
    this.stats[apiVersion].auth.lastExpiredTime = timestamp;
  }

  /**
   * Record a successful GET request
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the GET request succeeded
   */
  recordGetSuccess(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].get.success++;
    this.stats[apiVersion].get.lastSuccessTime = timestamp;
  }

  /**
   * Record a failed GET request
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the GET request failed
   */
  recordGetFailure(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].get.failed++;
    this.stats[apiVersion].get.lastFailedTime = timestamp;
  }

  /**
   * Record a successful PUT request
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the PUT request succeeded
   */
  recordPutSuccess(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].put.success++;
    this.stats[apiVersion].put.lastSuccessTime = timestamp;
  }

  /**
   * Record a failed PUT request
   * 
   * @param apiVersion - 'v1' or 'v2'
   * @param timestamp - When the PUT request failed
   */
  recordPutFailure(apiVersion: 'v1' | 'v2', timestamp: Date = new Date()): void {
    this.stats[apiVersion].put.failed++;
    this.stats[apiVersion].put.lastFailedTime = timestamp;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats = {
      v1: this.createEmptyStats(),
      v2: this.createEmptyStats(),
    };
  }

  /**
   * Reset statistics for a specific API version
   * 
   * @param apiVersion - 'v1' or 'v2'
   */
  resetApi(apiVersion: 'v1' | 'v2'): void {
    this.stats[apiVersion] = this.createEmptyStats();
  }
}
