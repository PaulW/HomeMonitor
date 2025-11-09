/**
 * Configuration Schema
 * 
 * Defines the structure, validation rules, and metadata for all plugin settings.
 * This serves as the single source of truth for:
 * - Configuration validation
 * - Settings UI generation
 * - Polling task definitions
 * - Default values
 */

/**
 * Field type for UI rendering
 */
export type FieldType = 'text' | 'password' | 'number' | 'select';

/**
 * Base field definition
 */
interface BaseField {
  /** Field label for UI */
  label: string;
  /** Help text/description */
  description: string;
  /** Field type */
  type: FieldType;
  /** Whether field is required */
  required: boolean;
  /** Default value */
  defaultValue: any;
}

/**
 * Number field with validation
 */
interface NumberField extends BaseField {
  type: 'number';
  min: number;
  max: number;
  step: number;
  /** Unit to display (e.g., "°C", "minutes") */
  unit?: string;
}

/**
 * Text/Password field
 */
interface TextField extends BaseField {
  type: 'text' | 'password';
  placeholder?: string;
}

/**
 * Polling task configuration
 */
export interface PollingTaskConfig extends NumberField {
  /** Unique task identifier */
  taskId: 'zoneStatus' | 'overrideReset' | 'scheduleRefresh';
  /** Task priority (1=highest) */
  priority: number;
  /** Minimum interval for smart rescheduling (in minutes) */
  minRescheduleThreshold: number;
}

/**
 * Field definition (union type)
 */
export type Field = NumberField | TextField;

/**
 * Configuration schema structure
 */
export interface ConfigSchema {
  credentials: {
    username: TextField;
    password: TextField;
  };
  settings: {
    dhwSetTemp: NumberField;
    boostTemp: NumberField;
  };
  polling: {
    zoneStatus: PollingTaskConfig;
    overrideReset: PollingTaskConfig;
    scheduleRefresh: PollingTaskConfig;
  };
}

/**
 * Configuration Schema Definition
 * 
 * Single source of truth for all plugin configuration
 */
export const CONFIG_SCHEMA: ConfigSchema = {
  credentials: {
    username: {
      label: 'Username',
      description: 'Your Honeywell EvoHome account email',
      type: 'text',
      required: true,
      defaultValue: '',
      placeholder: 'your.email@example.com',
    },
    password: {
      label: 'Password',
      description: 'Your Honeywell EvoHome account password',
      type: 'password',
      required: true,
      defaultValue: '',
      placeholder: 'Enter your password',
    },
  },
  settings: {
    dhwSetTemp: {
      label: 'Hot Water Set Temperature',
      description: 'Target temperature for domestic hot water',
      type: 'number',
      required: true,
      min: 40,
      max: 70,
      step: 1,
      unit: '°C',
      defaultValue: 55,
    },
    boostTemp: {
      label: 'Boost Temperature Increase',
      description: 'Temperature increase when boosting a zone',
      type: 'number',
      required: true,
      min: 0.5,
      max: 3.0,
      step: 0.5,
      unit: '°C',
      defaultValue: 1.5,
    },
  },
  polling: {
    zoneStatus: {
      taskId: 'zoneStatus',
      label: 'Zone Status Polling',
      description: 'How often to poll zone temperatures and status. More frequent polling provides faster updates but increases API load.',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      step: 1,
      unit: 'minutes',
      defaultValue: 5,
      priority: 1,
      minRescheduleThreshold: 1,
    },
    overrideReset: {
      taskId: 'overrideReset',
      label: 'Override Reset Check',
      description: 'How often to check for and reset unauthorized temperature overrides',
      type: 'number',
      required: true,
      min: 5,
      max: 15,
      step: 1,
      unit: 'minutes',
      defaultValue: 5,
      priority: 3,
      minRescheduleThreshold: 5,
    },
    scheduleRefresh: {
      taskId: 'scheduleRefresh',
      label: 'Schedule Refresh',
      description: 'How often to refresh heating schedules from the API',
      type: 'number',
      required: true,
      min: 30,
      max: 60,
      step: 5,
      unit: 'minutes',
      defaultValue: 30,
      priority: 2,
      minRescheduleThreshold: 30,
    },
  },
};

/**
 * Extract default configuration from schema
 */
export function getDefaultConfig(): any {
  return {
    credentials: {
      username: CONFIG_SCHEMA.credentials.username.defaultValue,
      password: CONFIG_SCHEMA.credentials.password.defaultValue,
    },
    settings: {
      dhwSetTemp: CONFIG_SCHEMA.settings.dhwSetTemp.defaultValue,
      boostTemp: CONFIG_SCHEMA.settings.boostTemp.defaultValue,
    },
    polling: {
      zoneStatus: CONFIG_SCHEMA.polling.zoneStatus.defaultValue,
      overrideReset: CONFIG_SCHEMA.polling.overrideReset.defaultValue,
      scheduleRefresh: CONFIG_SCHEMA.polling.scheduleRefresh.defaultValue,
    },
    overrideRules: [],
  };
}

/**
 * Validate a configuration value against schema
 */
export function validateField(
  section: keyof ConfigSchema,
  field: string,
  value: any
): { valid: boolean; error?: string } {
  const schema = (CONFIG_SCHEMA[section] as any)[field];
  
  if (!schema) {
    return { valid: false, error: `Unknown field: ${section}.${field}` };
  }

  if (schema.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${schema.label} is required` };
  }

  if (schema.type === 'number') {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return { valid: false, error: `${schema.label} must be a number` };
    }
    
    if (numValue < schema.min || numValue > schema.max) {
      return { 
        valid: false, 
        error: `${schema.label} must be between ${schema.min} and ${schema.max}${schema.unit ? ' ' + schema.unit : ''}` 
      };
    }
  }

  return { valid: true };
}

/**
 * Get polling task configurations
 */
export function getPollingTasks(): PollingTaskConfig[] {
  return [
    CONFIG_SCHEMA.polling.zoneStatus,
    CONFIG_SCHEMA.polling.overrideReset,
    CONFIG_SCHEMA.polling.scheduleRefresh,
  ];
}
