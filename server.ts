/**
 * Home Monitor Server
 * 
 * Main Express server with plugin system for monitoring and controlling smart home devices.
 * Features:
 * - Auto-discovery plugin system
 * - Global centralized logging
 * - Mustache template rendering with layouts
 * - RESTful API endpoints
 * - Static file serving
 * 
 * @module server
 */

// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Mustache from 'mustache';
import { getConfigManager } from './lib/config/index.js';
import { PluginLoader } from './lib/plugin-loader.js';
import { writeLog, rotateLogs, getLatestLogs } from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8080;

// ============================================================================
// Middleware Configuration
// ============================================================================

app.use(express.json());

// Serve core static files from www directory
app.use(express.static(join(__dirname, 'www')));

// Serve plugin static files from their web directories
// This allows plugins to have self-contained assets at /plugins/{pluginName}/{file}
app.use('/plugins/:pluginName', (req, res, next) => {
  const pluginName = req.params.pluginName;
  const pluginWebPath = join(__dirname, 'plugins', pluginName, 'web');
  express.static(pluginWebPath)(req, res, next);
});

// ============================================================================
// Plugin System Initialization
// ============================================================================

/** Plugin loader instance for managing all plugins */
const pluginLoader = new PluginLoader(join(__dirname, 'plugins'));

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Renders content within the main layout template
 * 
 * @param content - HTML content to render inside layout
 * @param title - Page title for browser tab
 * @param plugins - Array of plugin metadata for navigation sidebar
 * @returns Rendered HTML string with layout
 */
async function renderWithLayout(content: string, title: string, plugins: any[]) {
  const layoutPath = join(__dirname, 'www', 'templates', 'layout.html');
  const layoutTemplate = await readFile(layoutPath, 'utf-8');
  
  return Mustache.render(layoutTemplate, {
    title,
    content,
    plugins,
  });
}

// Make helpers available to plugins via app.locals
app.locals.renderWithLayout = renderWithLayout;

/**
 * Gets all plugins with their menu items for navigation sidebar
 * Includes system-level menu items (Activity Logs)
 * 
 * @returns Array of plugin metadata with menu sections
 */
app.locals.getPlugins = () => {
  const plugins = pluginLoader.getAllPlugins().map(p => ({
    name: p.metadata.name,
    menuItems: p.getMenuItems(),
  }));
  
  // Add system-level menu items
  plugins.push({
    name: 'System',
    menuItems: [
      {
        label: 'Activity Logs',
        path: '/logs',
        icon: '📋',
      },
    ],
  });
  
  return plugins;
};

// ============================================================================
// Routes - Home & Global Pages
// ============================================================================

/**
 * GET /
 * Renders the home landing page with installed plugins overview
 */
app.get('/', async (req, res) => {
  try {
    const homePath = join(__dirname, 'www', 'templates', 'home.html');
    const homeTemplate = await readFile(homePath, 'utf-8');
    
    const plugins = pluginLoader.getAllPlugins();
    const pluginData = plugins.map(p => ({
      id: p.metadata.name.toLowerCase(),
      name: p.metadata.name,
      version: p.metadata.version,
      description: p.metadata.description,
      icon: p.metadata.icon || '🔌'
    }));
    
    const html = await renderWithLayout(homeTemplate, 'Home', app.locals.getPlugins());
    const finalHtml = Mustache.render(html, {
      pluginCount: plugins.length,
      pluginCountPlural: plugins.length !== 1,
      hasPlugins: plugins.length > 0,
      plugins: pluginData
    });
    
    res.send(finalHtml);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    writeLog(`Failed to render home page: ${errorMsg}`, 'server', 'ERROR');
    res.status(500).send('Failed to load home page');
  }
});

/**
 * GET /logs
 * Renders the global activity logs page with filtering capabilities
 */
app.get('/logs', async (req, res) => {
  try {
    const logsPath = join(__dirname, 'www', 'templates', 'logs.html');
    const logsTemplate = await readFile(logsPath, 'utf-8');
    
    const html = await renderWithLayout(logsTemplate, 'Activity Logs', app.locals.getPlugins());
    res.send(html);
  } catch (error) {
    res.status(500).send('Failed to load logs page');
  }
});

/**
 * GET /api/logs
 * Returns raw log file content for the current day
 * Used by client-side polling for real-time log updates
 */
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await getLatestLogs();
    res.send(logs);
  } catch (error) {
    res.status(500).send('Failed to load logs');
  }
});

// ============================================================================
// Server Initialization
// ============================================================================

/**
 * Initializes and starts the Home Monitor server
 * 
 * Startup sequence:
 * 1. Rotates old log files (keeps 7 days)
 * 2. Loads all plugins from lib/plugins directory
 * 3. Registers plugin routes with Express
 * 4. Starts all plugin services
 * 5. Starts Express server on configured port
 * 
 * Handles graceful shutdown on SIGINT (Ctrl+C):
 * - Logs shutdown event
 * - Stops all plugin services
 * - Exits process cleanly
 * 
 * @throws {Error} If server fails to start or plugins fail to load
 */
async function startServer() {
  try {
    // Rotate old logs
    await rotateLogs(7);
    await writeLog('Server starting...', 'server', 'INFO');

    // Check if mock mode is enabled
    const isMockMode = process.env.HM_MOCK_MODE === 'true';
    
    if (isMockMode) {
      await writeLog('🎭 HM_MOCK_MODE enabled - Using in-memory storage (no database)', 'server', 'INFO');
    }

    // Load mock data dynamically from plugins if in mock mode
    let mockData: Record<string, any> | undefined;
    if (isMockMode) {
      mockData = await pluginLoader.loadMockData();
      await writeLog(`🎭 Loaded mock data for ${Object.keys(mockData).length} plugin(s)`, 'server', 'INFO');
    }

    // Initialize centralized configuration manager
    const configManager = getConfigManager({
      database: {
        type: 'sqlite',
        path: join(__dirname, 'data', 'home-monitor.db'),
      },
      enableCache: true,
      mockMode: isMockMode,
      mockData,
      verbose: isMockMode,
    });

    if (!process.env.HM_MASTER_KEY && !isMockMode) {
      await writeLog('WARNING: HM_MASTER_KEY not set. Using default key (INSECURE!)', 'server', 'WARNING');
      await writeLog('Please set HM_MASTER_KEY environment variable for production', 'server', 'WARNING');
    }

    try {
      // Initialize ConfigManager (mock or production)
      await configManager.initialize(process.env.HM_MASTER_KEY);
      await writeLog('ConfigManager initialized successfully', 'server', 'INFO');
    } catch (error) {
      await writeLog(`Failed to initialize ConfigManager: ${error}`, 'server', 'ERROR');
      throw error;
    }

    // Load all plugins
    await pluginLoader.loadPlugins();
    
    // Register plugin routes under /plugin/{pluginName}
    const plugins = pluginLoader.getAllPlugins();
    plugins.forEach(plugin => {
      const pluginPath = `/plugin/${plugin.metadata.name.toLowerCase()}`;
      app.use(pluginPath, plugin.getRouter());
      writeLog(`Registered routes for plugin: ${plugin.metadata.name} at ${pluginPath}`, 'server', 'INFO');
    });

    // Start all plugins
    await pluginLoader.startAll();

    // Start Express server
    app.listen(PORT, async () => {
      await writeLog(`Server started successfully on port ${PORT}`, 'server', 'INFO');
      await writeLog(`Loaded ${plugins.length} plugin(s)`, 'server', 'INFO');
      plugins.forEach(p => {
        writeLog(`  ${p.metadata.icon} ${p.metadata.name} (${p.metadata.version})`, 'server', 'INFO');
      });
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await writeLog('Server shutting down...', 'server', 'INFO');
      await pluginLoader.stopAll();
      
      // Shutdown config manager
      const configManager = getConfigManager();
      await configManager.shutdown();
      
      await writeLog('Server stopped', 'server', 'INFO');
      process.exit(0);
    });

  } catch (error) {
    await writeLog(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`, 'server', 'ERROR');
    process.exit(1);
  }
}

startServer();
