/**
 * Zone and Device Type Definitions
 * 
 * Types for zones, devices, and thermostat data
 */

/** Heat setpoint information for a zone */
export interface HeatSetpoint {
  value: number;
  status: string;
}

/** Changeable values for a thermostat */
export interface ChangeableValues {
  heatSetpoint?: HeatSetpoint;
  mode?: string;
  state?: string; // For DHW: 'On' or 'Off'
  status?: string; // For DHW: 'Temporary', 'Scheduled', etc.
  nextTime?: string; // For DHW: override end time
}

/** Thermostat data from EvoHome API */
export interface Thermostat {
  indoorTemperature?: number;
  indoorTemperatureStatus?: string;
  changeableValues: ChangeableValues;
}

/** Device/zone data from EvoHome API */
export interface Device {
  name?: string;
  thermostatModelType: string;
  thermostat: Thermostat;
  deviceID?: number;
  gatewayId?: number;
}

/** Location data containing devices */
export interface LocationData {
  locationID: number;
  devices: Device[];
}

/** Processed device details for display */
export interface DeviceDetails {
  /** Device ID for API operations */
  deviceID?: number;
  
  /** Room name */
  name: string;
  
  /** Current temperature (null if sensor failed) */
  curTemp: number | null;
  
  /** Target temperature (null if N/A) */
  setTemp: number | null;
  
  /** Status text (Following Schedule, Override Active, etc.) */
  status: string;
  
  /** Whether sensor has failed */
  isFailed: boolean;
  
  /** Whether room is in allowed override window */
  isOverrideAllowed?: boolean;
  
  /** Thermostat model type */
  thermostatModelType?: string;
  
  /** DHW actual state ('On' or 'Off') - only for DHW devices */
  dhwState?: string;
}

/** Result from runEvoHomeCheck operation */
export interface RunResult {
  /** Whether the check completed successfully */
  success: boolean;
  
  /** Timestamp when check was performed */
  timestamp: Date;
  
  /** Array of processed device details */
  devices: DeviceDetails[];
  
  /** Raw device data from API (for override reset operations) */
  rawDevices?: Device[];
  
  /** Number of overrides detected */
  overridesFound: number;
  
  /** Number of overrides that were reset */
  overridesReset: number;
  
  /** Number of failed sensors detected */
  failedSensors: number;
  
  /** Error message if operation failed */
  error?: string;
  
  logs: string[];
}

/** Result of override reset check operation */
export interface OverrideResetResult {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Timestamp of when the operation was performed */
  timestamp: Date;
  
  /** Number of overrides detected */
  overridesFound: number;
  
  /** Number of overrides that were reset */
  overridesReset: number;
  
  /** Error message if operation failed */
  error?: string;
  
  logs: string[];
}
