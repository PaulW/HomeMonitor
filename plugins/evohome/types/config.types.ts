/**
 * Configuration Type Definitions
 * 
 * Types for plugin configuration
 */

/** Time window for allowed overrides */
export interface TimeWindow {
  /** Start time in HH:MM format (24-hour) */
  start: string;
  
  /** End time in HH:MM format (24-hour) */
  end: string;
  
  /** Days when this window applies (lowercase) */
  days: string[];
}

/** Override rule for a specific room */
export interface OverrideRule {
  /** Name of the room this rule applies to */
  roomName: string;
  
  /** Whether overrides are allowed */
  allowOverride: boolean;
  
  /** Time windows when overrides are permitted */
  timeWindows: TimeWindow[];
}

/** Plugin configuration */
export interface Config {
  /** User credentials for Honeywell EvoHome */
  credentials: {
    username: string;
    password: string;
  };
  
  /** Application settings */
  settings: {
    /** Default DHW temperature (Domestic Hot Water) */
    dhwSetTemp: number;
    /** Boost temperature increase in °C (0.5-3.0, default 1.5) */
    boostTemp: number;
    /** Enable mock data mode for local testing (optional) */
    mockMode?: boolean;
  };
  
  /** Polling intervals in minutes */
  polling: {
    /** Zone temperature polling (1-5 minutes, default 5) */
    zoneStatus: number;
    /** Override reset check (5-15 minutes, default 5) */
    overrideReset: number;
    /** Schedule refresh (30-60 minutes, default 30) */
    scheduleRefresh: number;
  };
  
  /** Array of override rules for rooms */
  overrideRules: OverrideRule[];
}
