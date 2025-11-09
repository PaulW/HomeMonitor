/**
 * API Constants
 * 
 * Centralized configuration for all Honeywell EvoHome API endpoints and credentials.
 * These are Honeywell's official API endpoints and OAuth2 credentials - they are the
 * same for all users and rarely change.
 */

/**
 * V2 API Configuration
 * Uses session-based authentication with sessionId header
 * Base URL and Application ID are provided by Honeywell
 */
export const V2_API = {
  BASE_URL: 'https://tccna.honeywell.com/WebAPI/api',
  APPLICATION_ID: '91db1612-73fd-4500-91b2-e63b069b185c',
  AUTH_ENDPOINT: '/Session',
  LOCATIONS_ENDPOINT: '/locations',
  DEVICE_HEATSETPOINT: (deviceId: number) => `/devices/${deviceId}/thermostat/changeableValues/heatSetpoint`,
  DEVICE_VALUES: (deviceId: number) => `/devices/${deviceId}/thermostat/changeableValues`,
} as const;

/**
 * V1 API Configuration
 * Uses OAuth2 bearer token authentication
 * Base URL and Application ID are provided by Honeywell
 */
export const V1_API = {
  BASE_URL: 'https://tccna.honeywell.com/WebAPI/emea/api/v1',
  OAUTH_TOKEN_URL: 'https://tccna.honeywell.com/Auth/OAuth/Token',
  APPLICATION_ID: 'b013aa26-9724-4dbd-8897-048b9aada249',
  SCHEDULE_ENDPOINT: (zoneType: 'temperatureZone' | 'domesticHotWater', zoneId: string) => 
    `/${zoneType}/${zoneId}/schedule`,
  DHW_STATE_ENDPOINT: (dhwId: string) => `/domesticHotWater/${dhwId}/state`,
} as const;

/**
 * OAuth2 Client Credentials
 * 
 * These are PUBLIC credentials that identify the application to Honeywell's API.
 * They are NOT user credentials - user username/password are sent separately in the request body.
 * 
 * The Authorization: Basic header contains: CLIENT_ID:CLIENT_SECRET in Base64
 * Decoded: 4a231089-d2b6-41bd-a5eb-16a0a422b999:1a15cdb8-42de-407b-add0-059f92c530cb
 * 
 * These credentials are documented in Honeywell's API documentation and are the same
 * for all users of the EvoHome API.
 */
export const OAUTH2 = {
  // Base64 encoded CLIENT_ID:CLIENT_SECRET for OAuth2 password grant
  CLIENT_CREDENTIALS_BASIC: 'Basic NGEyMzEwODktZDJiNi00MWJkLWE1ZWItMTZhMGE0MjJiOTk5OjFhMTVjZGI4LTQyZGUtNDA3Yi1hZGQwLTA1OWY5MmM1MzBjYg==',
  // OAuth2 scopes required for V1 API access
  SCOPES: 'EMEA-V1-Basic EMEA-V1-Anonymous EMEA-V1-Get-Current-User-Account',
  // Grant type for resource owner password credentials flow
  GRANT_TYPE: 'password',
} as const;
