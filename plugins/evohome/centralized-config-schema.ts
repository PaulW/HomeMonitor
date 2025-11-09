/**
 * EvoHome Configuration Schema for Centralized Config System
 * 
 * Defines validation rules and sensitive fields for the centralized
 * configuration management system.
 */

import type { PluginConfigSchema } from '../../lib/config/index.js';
import type { Config } from './types/config.types.js';

/**
 * Configuration schema for EvoHome plugin
 * Used by centralized ConfigManager for validation and encryption
 */
export const evohomeConfigSchema: PluginConfigSchema<Config> = {
  version: 1,

  // Fields that should be encrypted in database
  sensitiveFields: [
    'credentials.password',
  ],

  // Validation rules
  validation: {
    'credentials.username': {
      type: 'string',
      required: true,
      minLength: 3,
      format: 'email',
    },
    'credentials.password': {
      type: 'string',
      required: true,
      minLength: 6,
    },
    'settings.dhwSetTemp': {
      type: 'number',
      required: true,
      min: 40,
      max: 70,
    },
    'settings.boostTemp': {
      type: 'number',
      required: true,
      min: 0.5,
      max: 3.0,
    },
    'polling.zoneStatus': {
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    'polling.overrideReset': {
      type: 'number',
      required: true,
      min: 5,
      max: 15,
    },
    'polling.scheduleRefresh': {
      type: 'number',
      required: true,
      min: 30,
      max: 60,
    },
    'overrideRules': {
      type: 'array',
    },
  },

  // Default values
  defaults: {
    credentials: {
      username: '',
      password: '',
    },
    settings: {
      dhwSetTemp: 55,
      boostTemp: 1.5,
    },
    polling: {
      zoneStatus: 5,
      overrideReset: 5,
      scheduleRefresh: 30,
    },
    overrideRules: [],
  },

  // UI metadata for settings page
  ui: {
    sections: [
      {
        title: 'Credentials',
        description: 'Your Honeywell EvoHome account credentials',
        fields: ['credentials.username', 'credentials.password'],
      },
      {
        title: 'Settings',
        description: 'Temperature and heating settings',
        fields: ['settings.dhwSetTemp', 'settings.boostTemp'],
      },
      {
        title: 'Polling Intervals',
        description: 'How often to poll the API (in minutes)',
        fields: [
          'polling.zoneStatus',
          'polling.overrideReset',
          'polling.scheduleRefresh',
        ],
      },
    ],
    labels: {
      'credentials.username': 'Username',
      'credentials.password': 'Password',
      'settings.dhwSetTemp': 'Hot Water Set Temperature (°C)',
      'settings.boostTemp': 'Boost Temperature Increase (°C)',
      'polling.zoneStatus': 'Zone Status Polling (minutes)',
      'polling.overrideReset': 'Override Reset Check (minutes)',
      'polling.scheduleRefresh': 'Schedule Refresh (minutes)',
    },
    descriptions: {
      'credentials.username': 'Your Honeywell EvoHome account email',
      'credentials.password': 'Your Honeywell EvoHome account password',
      'settings.dhwSetTemp': 'Target temperature for domestic hot water (40-70°C)',
      'settings.boostTemp': 'Temperature increase when boosting a zone (0.5-3.0°C)',
      'polling.zoneStatus':
        'How often to poll zone temperatures and status (1-5 minutes)',
      'polling.overrideReset':
        'How often to check for and reset unauthorized overrides (5-15 minutes)',
      'polling.scheduleRefresh':
        'How often to refresh heating schedules from the API (30-60 minutes)',
    },
  },
};
