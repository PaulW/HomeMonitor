/**
 * HTTP Utilities
 * 
 * Common HTTP request patterns used across API clients:
 * - Time calculations for overrides
 * - Response error handling
 * - Request header building
 * 
 * @module plugins/evohome/utils/http
 */

/**
 * Calculates end time for an override, rounded to nearest 5 minutes
 * 
 * EvoHome API requires override end times to be rounded to 5-minute intervals.
 * This function takes a duration and calculates the appropriate end time.
 * 
 * @param durationMinutes - Duration in minutes
 * @returns ISO 8601 timestamp rounded to nearest 5 minutes
 * 
 * @example
 * // Current time: 14:32:00
 * calculateOverrideEndTime(60);
 * // Returns: "2024-11-05T15:35:00.000Z" (60 min later, rounded to :35)
 */
export function calculateOverrideEndTime(durationMinutes: number): string {
  const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);
  const minutes = endTime.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 5) * 5;
  
  // setMinutes automatically handles values >= 60 (rolls to next hour)
  endTime.setMinutes(roundedMinutes);
  endTime.setSeconds(0);
  endTime.setMilliseconds(0);
  
  return endTime.toISOString();
}

/**
 * Extracts error message from HTTP response
 * 
 * Attempts to parse JSON error response, falls back to text if JSON fails.
 * 
 * @param response - Fetch Response object
 * @returns Error message string
 * 
 * @example
 * const errorMsg = await extractErrorMessage(response);
 * throw new Error(`API error: ${errorMsg}`);
 */
export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string; error?: string };
    return data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
  } catch {
    // Failed to parse JSON, try text
    try {
      return await response.text();
    } catch {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  }
}

/**
 * Builds standard headers for V2 API requests
 * 
 * @param sessionId - V2 API session ID
 * @returns Headers object for fetch
 * 
 * @example
 * const headers = buildV2Headers(session.sessionId);
 * fetch(url, { headers, method: 'GET' });
 */
export function buildV2Headers(sessionId: string): Record<string, string> {
  return {
    'sessionId': sessionId,
    'Content-Type': 'application/json',
  };
}

/**
 * Builds standard headers for V1 API requests
 * 
 * @param bearerToken - V1 API OAuth bearer token
 * @returns Headers object for fetch
 * 
 * @example
 * const headers = buildV1Headers(token);
 * fetch(url, { headers, method: 'GET' });
 */
export function buildV1Headers(bearerToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
  };
}
