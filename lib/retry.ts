/**
 * Retry Utilities
 * 
 * Helper functions for retry logic and exponential backoff
 * 
 * @module lib/retry
 */

/**
 * Adds delay between operations
 * @param ms - Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 * 
 * Automatically handles 429 (rate limit) errors with exponential backoff.
 * Delays double with each retry: 1s, 2s, 4s, etc.
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param logger - Optional logging function
 * @returns Result of the function
 * @throws {Error} If all retries fail
 * 
 * @example
 * const data = await retryWithBackoff(
 *   () => fetchDataFromAPI(),
 *   3,  // Try up to 3 times
 *   1000,  // Start with 1 second delay
 *   (msg) => console.log(msg)
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  logger?: (msg: string) => void
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      const isRateLimit = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('TooManyRequests'));
      
      if (attempt === maxRetries || !isRateLimit) {
        throw error;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt);
      const msg = `⏳ Rate limit hit, waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}...`;
      if (logger) logger(msg);
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}
