/**
 * Plugin Interface for Home Monitor
 * 
 * Defines the contract that all plugins must implement to integrate
 * with the Home Monitor platform. Plugins provide:
 * - Metadata (name, description, version)
 * - Navigation menu items for sidebar
 * - Express routes for pages and APIs
 * - Optional lifecycle methods (start/stop)
 * 
 * @module plugin-interface
 */

import { Router } from 'express';

/**
 * Plugin metadata for identification and display
 */
export interface PluginMetadata {
  /** Unique identifier (e.g., 'evohome', 'nest', 'philips-hue') */
  id: string;
  
  /** Display name shown in navigation (e.g., 'EvoHome') */
  name: string;
  
  /** Brief description of plugin functionality */
  description: string;
  
  /** Optional emoji or icon for navigation (e.g., '🌡️', '💡') */
  icon?: string;
  
  /** Semantic version string (e.g., '1.0.0') */
  version: string;
}

/**
 * Route definition for plugin endpoints
 * @deprecated Use Router.get/post/put/delete directly instead
 */
export interface PluginRoute {
  /** URL path (e.g., '/evohome/dashboard') */
  path: string;
  
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  
  /** Request handler function */
  handler: (req: any, res: any) => void | Promise<void>;
}

/**
 * Navigation menu item for plugin pages
 */
export interface MenuItem {
  /** Display text for menu link (e.g., 'Dashboard', 'Settings') */
  label: string;
  
  /** URL path to navigate to */
  path: string;
  
  /** Optional emoji or icon (e.g., '📊', '⚙️') */
  icon?: string;
}

/**
 * Plugin interface that all plugins must implement
 * 
 * @example
 * ```typescript
 * export const plugin: Plugin = {
 *   metadata: {
 *     id: 'example',
 *     name: 'Example Plugin',
 *     description: 'Example smart home integration',
 *     icon: '🏠',
 *     version: '1.0.0'
 *   },
 *   
 *   async init() {
 *     // Load configuration, initialize state
 *   },
 *   
 *   getMenuItems() {
 *     return [
 *       { label: 'Dashboard', path: '/example', icon: '📊' }
 *     ];
 *   },
 *   
 *   getRouter() {
 *     const router = Router();
 *     router.get('/example', async (req, res) => {
 *       // Render page
 *     });
 *     return router;
 *   }
 * };
 * ```
 */
export interface Plugin {
  /** Plugin identification and display information */
  metadata: PluginMetadata;
  
  /**
   * Initializes the plugin
   * 
   * Called once when the plugin is loaded during server startup.
   * Use this to:
   * - Load configuration files
   * - Initialize state
   * - Validate requirements
   * - Set up connections (but don't start background tasks yet)
   * 
   * @throws Should throw if initialization fails
   */
  init(): Promise<void>;
  
  /**
   * Gets navigation menu items for this plugin
   * 
   * Returns array of menu items that will appear in the sidebar
   * under the plugin's name section.
   * 
   * @returns Array of menu items (can be empty)
   */
  getMenuItems(): MenuItem[];
  
  /**
   * Gets the Express router for this plugin's routes
   * 
   * Should define all HTTP routes (pages and APIs) for the plugin.
   * Routes are automatically mounted by the plugin loader.
   * 
   * @returns Express Router instance with plugin routes
   */
  getRouter(): Router;
  
  /**
   * Starts background tasks (optional)
   * 
   * Called after all plugins are loaded and routes are registered.
   * Use this to:
   * - Start polling intervals
   * - Begin scheduled tasks
   * - Open persistent connections
   * 
   * This method is optional - only implement if needed.
   */
  start?(): void;
  
  /**
   * Stops background tasks (optional)
   * 
   * Called during graceful shutdown (e.g., SIGINT).
   * Use this to:
   * - Stop polling intervals
   * - Cancel scheduled tasks
   * - Close connections
   * - Clean up resources
   * 
   * This method is optional - only implement if needed.
   */
  stop?(): void;
}
