/**
 * API Type Definitions
 * 
 * Types for EvoHome API requests and responses
 */

/** V2 API Authentication response */
export interface AuthResponse {
  userInfo: {
    userID: string;
  };
  sessionId: string;
}

/** V1 API OAuth2 token response */
export interface V1TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

/** Cached session data */
export interface SessionCache {
  userId: string;
  sessionId: string;
}

/** Cached V1 token data */
export interface TokenCache {
  token: string;
  expiresAt: Date;
}
