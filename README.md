# Home Monitor

A modern, extensible TypeScript application for monitoring and controlling smart home devices with a robust plugin architecture. Features a dynamic landing page, self-contained plugins, and comprehensive Honeywell EvoHome integration with automatic zone management, time-based override rules, and a real-time web dashboard.

## Architecture

**Home Monitor** is built with a clean, extensible plugin system that keeps core and plugin code completely separated:

- **Plugin System**: Truly modular architecture with self-contained plugins at `/plugin/{name}/*`
- **Core Utilities**: Shared JavaScript utilities (API fetch, templates, time formatting, UI helpers)
- **Global Logging**: Centralized logging with source tracking and 7-day rotation
- **Smart Caching**: Session management with sliding expiration and optimistic updates
- **Real-time Updates**: Live dashboard polling with sub-second refresh rates
- **Modern UI**: Clean web interface with collapsible navigation and localStorage state persistence

## Features

### Core System
- 🏠 **Landing Page**: Dynamic home page showing all installed plugins with stats and quick links
- 🔌 **Plugin Architecture**: Completely self-contained plugins with their own routes, templates, and assets
- 📝 **Global Activity Logs**: Centralized logging with filters by level and source
- 🎨 **Modern Web UI**: Clean, responsive interface with collapsible sidebar navigation
- 🔄 **Auto-refresh**: Real-time updates across all dashboard pages
- 💾 **Smart Caching**: Intelligent data caching with optimistic updates and automatic failover
- 🎯 **Core Utilities**: Shared JavaScript libraries (utils.js, template-helpers.js) for common functionality
- 📍 **Smart Navigation**: Auto-expanding menus with localStorage state persistence

### EvoHome Plugin
- 🌡️ Monitor all EvoHome zones with live temperature readings
- 🔄 Automatic override reset every 5 minutes (configurable time windows)
- ⚙️ Time-based rules for each room (day of week + time range)
- 📊 Visual dashboard with EvoHome controller-style temperature display
- 🔴 Sensor failure detection with graceful degradation
- 🔐 Session management with sliding expiration (no unnecessary re-auth)
- 📈 Comprehensive API statistics tracking (authentication, GET/PUT requests)
- 📤 API request logging with full traceability
- ⏱️ Polling operations monitoring with run counts and status tracking
- 🗓️ Zone schedule viewer and editor
- ⚙️ Dynamic settings interface with schema validation

## Quick Start

### Installation

```bash
npm install
```

### Environment Setup

The application uses environment variables for sensitive configuration. Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and set your values:

```bash
# Required: Master encryption key for secure configuration storage
# Generate a secure key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
HM_MASTER_KEY=your-generated-secure-key-here

# Optional: Server port (default: 8080)
PORT=8080

# Optional: Enable mock mode for testing without real API calls or database
HM_MOCK_MODE=false
```

**Important**: 
- The `.env` file is gitignored and will not be committed
- Generate a unique `HM_MASTER_KEY` for each environment
- Keep this key secure - it encrypts sensitive plugin configuration data
- See [Configuration Management](docs/CONFIG_QUICKSTART.md) for details

### Start the Server

```bash
npm run server
```

Open your browser to: **http://localhost:8080**

The landing page will show all installed plugins with quick access to their features.

## Project Structure

```
home-monitor/
├── server.ts                          # Main Express server with plugin system
├── .env.example                       # Environment variables template
├── lib/
│   ├── config/                        # Configuration management system
│   │   ├── config-manager.ts          # Main config manager
│   │   ├── encryption.ts              # AES-256-GCM encryption
│   │   ├── schema.ts                  # Database schema (Drizzle ORM)
│   │   ├── types.ts                   # TypeScript types
│   │   ├── index.ts                   # Public exports
│   │   ├── test-config.ts             # Integration tests
│   │   ├── adapters/
│   │   │   ├── base-adapter.ts        # Abstract adapter interface
│   │   │   ├── sqlite-adapter.ts      # SQLite implementation (production)
│   │   │   └── memory-adapter.ts      # In-memory implementation (mock mode)
│   │   └── migrations/                # Database migrations
│   ├── logger.ts                      # Global centralized logging
│   ├── plugin-interface.ts            # Plugin contract/interface
│   ├── plugin-loader.ts               # Auto-discovery and lifecycle management
│   ├── route-helpers.ts               # Shared route utilities (asyncHandler, parseIntSafe)
│   ├── task-scheduler.ts              # Core task scheduling system
│   ├── template-renderer.ts           # Plugin template rendering with layout
│   ├── retry.ts                       # Exponential backoff retry utility
│   ├── stats-tracker.ts               # API statistics tracking
│   └── time-utils.ts                  # Time formatting and calculations
├── plugins/                           # Self-contained plugin modules
│   └── evohome/
│       ├── index.ts                   # Plugin entry point
│       ├── routes.ts                  # Express routes
│       ├── config-schema.ts           # JSON schema for validation
│       ├── centralized-config-schema.ts # Schema for centralized config
│       ├── README.md                  # Plugin documentation
│       ├── api/                       # API clients
│       │   ├── auth-manager.ts        # Authentication handling
│       │   ├── v1-api.ts              # EvoHome V1 API client
│       │   ├── v2-api.ts              # EvoHome V2 API client
│       │   ├── mock-api-client.ts     # Mock V2 API client (mock mode)
│       │   ├── mock-v1-api-client.ts  # Mock V1 API client (mock mode)
│       │   ├── mock-data.ts           # Mock data generator
│       │   └── constants.ts           # API constants
│       ├── services/                  # Business logic
│       │   ├── device-cache-service.ts
│       │   ├── override-service.ts
│       │   ├── schedule-service.ts
│       │   ├── zone-service.ts
│       │   └── api-stats-tracker.ts
│       ├── types/                     # TypeScript interfaces
│       │   ├── api.types.ts
│       │   ├── config.types.ts
│       │   ├── schedule.types.ts
│       │   └── zone.types.ts
│       ├── utils/                     # Plugin-specific utilities
│       │   ├── logger.ts
│       │   ├── http.ts
│       │   └── service-initializer.ts
│       └── web/                       # Web assets (self-contained)
│           ├── css/
│           │   └── evohome.css        # Plugin-specific styles
│           ├── js/                    # Plugin-specific JavaScript
│           │   ├── evohome-utils.js
│           │   ├── evohome-dashboard-display.js
│           │   ├── evohome-override-control.js
│           │   ├── evohome-scheduler.js
│           │   ├── evohome-settings.js
│           │   └── evohome-status.js
│           └── templates/             # Plugin HTML templates
│               ├── dashboard.html
│               ├── override-control.html
│               ├── scheduler.html
│               ├── settings.html
│               └── status.html
├── www/                               # Core web assets
│   ├── css/
│   │   └── styles.css                 # Global styles (layout, badges, toasts)
│   ├── js/                            # Core JavaScript utilities
│   │   ├── utils.js                   # Time, messages, API fetch, validation
│   │   ├── template-helpers.js        # Template loading and caching
│   │   ├── dom-differ.js              # DOM diffing utility
│   │   ├── scripts.js                 # Sidebar toggle
│   │   └── logs.js                    # Activity logs viewer
│   └── templates/                     # Core HTML templates
│       ├── layout.html                # Main layout with navigation
│       ├── home.html                  # Landing page
│       └── logs.html                  # Global activity logs
├── data/
│   └── home-monitor.db                # SQLite database (gitignored)
├── logs/
│   └── home-monitor-YYYY-MM-DD.log    # Daily log files (7-day rotation)
├── docs/                              # Refactoring and architecture docs
│   ├── archive/                       # Historical/superseded documentation
│   ├── CONFIG_QUICKSTART.md           # Configuration system guide
│   ├── MOCK_MODE_USAGE.md             # Mock mode documentation
│   └── ... (other documentation)
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript configuration
└── README.md                          # This file
```

## URL Structure

All plugins are mounted at `/plugin/{name}` to maintain a clean, plugin-agnostic server:

- **Core Routes**:
  - `GET /` - Landing page with plugin overview
  - `GET /logs` - Global activity logs
  - `GET /api/logs` - Raw log data (JSON)
  - `GET /js/*.js` - Core JavaScript utilities
  - `GET /css/*.css` - Core styles

- **Plugin Routes** (using EvoHome as example):
  - `GET /plugin/evohome` - Plugin dashboard
  - `GET /plugin/evohome/{page}` - Plugin pages
  - `GET /plugin/evohome/api/*` - Plugin API endpoints
  - `GET /plugins/evohome/js/*.js` - Plugin JavaScript
  - `GET /plugins/evohome/css/*.css` - Plugin styles

## Web Dashboard

### Landing Page

The home page (`/`) displays:
- Hero section with application overview
- **Plugin Cards**: Each installed plugin shown with:
  - Name, version, description
  - Plugin icon
  - Status indicator
  - Quick link to dashboard
- **System Stats**: Plugin count, active tasks
- **Quick Links**: Activity Logs, Documentation

### Navigation

The collapsible sidebar provides access to all plugins and system features:

- **🏠 Home Monitor** (clickable header returns to landing page)
  
- **EvoHome** (collapsible section)
  - 📊 Dashboard - Room temperature cards with real-time updates
  - ⚙️ Override Control - Time-based rule configuration
  - �️ Scheduler - Zone schedule viewer and editor
  - �📈 Status - API statistics and polling operations monitoring
  - ⚙️ Settings - System configuration
  
- **System** (collapsible section)
  - 📋 Activity Logs - Global logs with filtering

**Navigation Features**:
- Sections persist their collapsed/expanded state in localStorage
- Active page's section automatically expands on navigation
- Smooth transitions without jarring animations

### EvoHome Dashboard

Visual room cards displaying:
- Large, prominent current temperature
- Secondary set/target temperature
- Heating/cooling indicator (colored bar)
- Room status badge (Scheduled/Override/Failed)
- Quick action buttons (Boost/Cool/Schedule - planned)

**Auto-refresh**: Every 1 second for near-realtime updates

### Status Page

Comprehensive monitoring of API operations and polling tasks:

**API Statistics** (V1 & V2):
- **Authentication**: Success/Failed/Total counts with timestamps
- **GET Requests**: Success/Failed/Total counts with timestamps
- **PUT Requests**: Success/Failed/Total counts with timestamps
- Color-coded counters (green=success, red=failed, black=total, gray=zero)
- Last success and last failed timestamps for all operation types

**Polling Operations**:
- Zone Status, Override Reset, Schedule Refresh
- Interval, total runs, last/next poll times
- Countdown timers and status indicators
- Success/failure tracking with detailed error messages

**Auto-refresh**: Every 1 second for real-time monitoring

### Override Control

Configure time-based override rules through a visual editor:
- Enable/disable override permission per room
- Multiple time windows per room
- Day-of-week selection
- 24-hour time format (HH:MM)
- Visual editor with add/remove controls
- Save/Cancel with validation

### Scheduler

View and edit zone heating schedules:
- Visual week view with day/time grid
- Import schedules from API
- Edit temperature setpoints
- Preview before applying changes
- Export schedules back to EvoHome system

### Settings

Dynamic configuration interface:
- Schema-driven form generation
- Real-time validation
- Test API connection before saving
- Secure credential management

### Activity Logs

Centralized logging with advanced filtering:
- **By Level**: Info, Success, Warning, Error
- **By Source**: server, evohome, or any plugin
- **Auto-refresh**: Every 10 seconds
- **Color-coded**: Easy visual parsing
- **Full timestamps**: HH:mm:ss DD/MM/YYYY format
- **Search**: Filter logs by keyword

## Configuration

### EvoHome Plugin Configuration

Located in `plugins/evohome/config.json`:

```json
{
  "credentials": {
    "username": "your-email@example.com",
    "password": "your-password",
    "applicationId": "your-app-id"
  },
  "checkInterval": 60000,
  "scheduleRefreshInterval": 1800000,
  "overrideResetInterval": 300000,
  "overrideRules": [
    {
      "roomName": "Living Room",
      "allowOverride": true,
      "timeWindows": [
        {
          "start": "17:00",
          "end": "23:00",
          "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        }
      ]
    }
  ]
}
```

**Configuration Options**:
- `credentials`: EvoHome API authentication
- `checkInterval`: Zone status polling interval (ms)
- `scheduleRefreshInterval`: Schedule update interval (ms)
- `overrideResetInterval`: Override check interval (ms)
- `overrideRules`: Time-based override blocking rules

**Override Rule Logic** (Allow with Restrictions):
- **Default behavior (no rule)**: Overrides are ALWAYS ALLOWED
- **Rule with `allowOverride: false`**: Overrides are ALWAYS ALLOWED (blocking disabled, time windows ignored)
- **Rule with `allowOverride: true`**: Blocking enabled - overrides are ALLOWED except during blocked time windows
  - Time windows define when overrides are BLOCKED (NOT allowed)
  - Outside of blocked windows, overrides are allowed
  - No time windows = overrides allowed at all times (blocking enabled but no restrictions defined)
- Rules can be edited through the web UI or directly in the database

**Understanding the Logic**:
The system uses an "allow with restrictions" approach:
1. By default, all overrides are allowed everywhere
2. When you enable "Block Overrides" for a room, you activate time-based blocking
3. Blocked time windows define specific times when overrides are NOT ALLOWED
4. Outside of blocked windows, overrides are allowed
5. This allows you to say "Block overrides during work hours (09:00-17:00)" or "Block overrides on weeknights"

### Example Scenarios

**Block overrides during work hours (09:00-17:00 weekdays):**
```json
{
  "roomName": "Office",
  "allowOverride": true,
  "timeWindows": [
    {
      "start": "09:00",
      "end": "17:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }
  ]
}
```
*Result: Manual overrides in Office are BLOCKED 09:00-17:00 on weekdays. Allowed at all other times.*

**Block overrides overnight (23:00-06:00 daily):**
```json
{
  "roomName": "Living Room",
  "allowOverride": true,
  "timeWindows": [
    {
      "start": "23:00",
      "end": "06:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }
  ]
}
```
*Result: Manual overrides in Living Room are BLOCKED overnight. Allowed during daytime.*

**Never block overrides (24/7 allowed):**
```json
{
  "roomName": "Bedroom",
  "allowOverride": false,
  "timeWindows": []
}
```
*Result: Manual overrides in Bedroom are ALWAYS allowed. Blocking disabled.*

**Multiple blocked windows (morning + afternoon):**
```json
{
  "roomName": "Kitchen",
  "allowOverride": true,
  "timeWindows": [
    {
      "start": "07:00",
      "end": "09:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    },
    {
      "start": "17:00",
      "end": "19:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }
  ]
}
```
*Result: Manual overrides in Kitchen are BLOCKED during busy meal times (breakfast and dinner on weekdays).*
      "end": "23:59",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }
  ]
}
```

## How It Works

### System Flow

1. **Server Startup**: Express server initializes and loads plugins
2. **Plugin Discovery**: Plugin loader scans `lib/plugins/` directory
3. **Plugin Initialization**: Each plugin registers routes and starts schedulers
4. **Scheduled Checks**: EvoHome plugin runs every 5 minutes
5. **Session Management**: Authentication token cached with sliding expiration
6. **Rule Evaluation**: Override status checked against time-based configuration
7. **Automatic Reset**: Unauthorized overrides restored to scheduled mode
8. **Dashboard Updates**: Client polls every second for real-time data
9. **Graceful Degradation**: Cached data displayed during API failures

### Session Management

The EvoHome plugin uses intelligent session caching:

- **Sliding Expiration**: Session stays valid as long as API requests continue
- **Single Authentication**: Only one auth call at startup (with polling)
- **Automatic Recovery**: 401 responses trigger session refresh
- **Rate Limit Prevention**: Minimizes authentication endpoint usage

### Logging System

Global logging with format: `HH:mm:ss DD/MM/YYYY [source] [LEVEL] message`

**Log Levels**:
- `INFO` - General information (cyan)
- `SUCCESS` - Successful operations (green)
- `WARNING` - Non-critical issues (yellow)
- `ERROR` - Failures requiring attention (red)

**Features**:
- 7-day automatic rotation
- Source tracking (server, evohome, future plugins)
- Web-based log viewer with filtering
- File-based persistence in `logs/` directory

## API Endpoints

### Core System

- `GET /` - Landing page with plugin overview
- `GET /logs` - Activity logs viewer
- `GET /api/logs` - Raw log file content (JSON)

### EvoHome Plugin

**HTML Pages**:
- `GET /plugin/evohome` - Dashboard with room temperature cards
- `GET /plugin/evohome/override-control` - Configuration interface
- `GET /plugin/evohome/scheduler` - Zone schedule viewer and editor
- `GET /plugin/evohome/status` - System status and API statistics page
- `GET /plugin/evohome/settings` - System settings

**API Endpoints**:
- `GET /plugin/evohome/api/status` - Current zone data, polling status, and API statistics (JSON)
- `GET /plugin/evohome/api/polling-status` - Detailed polling operation status (JSON)
- `GET /plugin/evohome/api/config` - Override rules and configuration (JSON)
- `GET /plugin/evohome/api/schema` - Configuration JSON schema (JSON)
- `GET /plugin/evohome/api/schedules` - Zone schedules (JSON)
- `POST /plugin/evohome/api/config` - Update configuration
- `POST /plugin/evohome/api/settings` - Update settings
- `POST /plugin/evohome/api/schedules` - Update zone schedules
- `POST /plugin/evohome/api/boost/zone` - Boost zone temperature
- `POST /plugin/evohome/api/boost/cancel` - Cancel zone boost
- `POST /plugin/evohome/api/boost/dhw` - Boost hot water
- `POST /plugin/evohome/api/run` - Manual check trigger
- `POST /plugin/evohome/api/test` - Test API connection

## Adding New Plugins

Plugins are completely self-contained modules in the `plugins/` directory:

### 1. Create Plugin Structure

```bash
plugins/your-plugin/
├── index.ts                    # Plugin entry point
├── routes.ts                   # Express routes
├── config.json                 # Plugin configuration
├── web/
│   ├── css/
│   │   └── your-plugin.css
│   ├── js/
│   │   └── your-plugin-utils.js
│   └── templates/
│       └── dashboard.html
```

### 2. Implement Plugin Interface

Create `index.ts`:

```typescript
import { Plugin } from '../../lib/plugin-interface.js';
import { Express, Router } from 'express';
import { createRouter } from './routes.js';

export default class YourPlugin implements Plugin {
  metadata = {
    name: 'Your Plugin',
    version: '1.0.0',
    description: 'Your plugin description',
    icon: '🔌'
  };
  
  private router?: Router;
  
  async initialize(): Promise<void> {
    // Setup logic (load config, etc.)
  }
  
  getMenuItems() {
    return [
      { label: 'Dashboard', path: '/plugin/your-plugin', icon: '📊' },
      { label: 'Settings', path: '/plugin/your-plugin/settings', icon: '⚙️' }
    ];
  }
  
  getRouter(): Router {
    if (!this.router) {
      this.router = createRouter();
    }
    return this.router;
  }
  
  async start(): Promise<void> {
    // Start schedulers, polling, etc.
  }
  
  async stop(): Promise<void> {
    // Cleanup
  }
}
```

### 3. Create Routes

Create `routes.ts`:

```typescript
import { Router } from 'express';
import { renderPluginTemplate } from '../../lib/template-renderer.js';

export function createRouter(): Router {
  const router = Router();
  
  // HTML Pages
  router.get('/', async (req, res) => {
    await renderPluginTemplate('your-plugin', 'dashboard', 'Dashboard', req, res);
  });
  
  // API Endpoints
  router.get('/api/data', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  return router;
}
```

### 4. Create Templates

Create `web/templates/dashboard.html`:

```html
<div class="container">
  <h1>🔌 Your Plugin Dashboard</h1>
  <!-- Your content here -->
</div>

<link rel="stylesheet" href="/plugins/your-plugin/css/your-plugin.css">
<script src="/plugins/your-plugin/js/your-plugin-utils.js"></script>
<script>
  // Your JavaScript here - can use core utilities:
  // - apiFetch() from /js/utils.js
  // - loadTemplates() from /js/template-helpers.js
  // - formatTime(), showSuccess(), etc.
</script>
```

### 5. Plugin Auto-Discovery

The plugin will be automatically discovered and loaded on server start. Server is completely plugin-agnostic - no code changes needed!

**Plugin URL Structure**:
- Pages: `/plugin/your-plugin/*`
- API: `/plugin/your-plugin/api/*`
- Assets: `/plugins/your-plugin/js/*`, `/plugins/your-plugin/css/*`

## Technologies

- **Runtime**: Node.js 18+ (native fetch API)
- **Language**: TypeScript 5
- **Server**: Express 5
- **Templating**: Mustache
- **Styling**: Pure CSS (no frameworks)
- **Architecture**: Plugin-based with clean separation of concerns
- **State Management**: localStorage for UI state, server-side caching for data

## Core Utilities

### JavaScript Libraries (www/js/)

- **utils.js**: Common utilities shared across all pages
  - `apiFetch()` - Fetch wrapper with error handling
  - `formatTime()`, `formatDuration()` - Time formatting
  - `showSuccess()`, `showError()`, `showToast()` - User notifications
  - `validateTimeWindow()` - Time validation
  - Temperature conversion helpers

- **template-helpers.js**: Template loading and caching
  - `loadTemplates()` - Load HTML templates
  - `cacheTemplate()` - Cache management
  - Mustache rendering helpers

- **scripts.js**: Global UI behaviors
  - Sidebar toggle
  - Navigation state management

- **logs.js**: Activity logs viewer
  - Log filtering by level and source
  - Auto-refresh with polling
  - Search functionality

### TypeScript Libraries (lib/)

- **plugin-interface.ts**: Plugin contract definition
- **plugin-loader.ts**: Auto-discovery and lifecycle
- **logger.ts**: Centralized logging with rotation
- **task-scheduler.ts**: Priority-based task scheduling
- **template-renderer.ts**: Plugin template rendering
- **route-helpers.ts**: asyncHandler, parseIntSafe
- **retry.ts**: Exponential backoff retry logic
- **stats-tracker.ts**: API statistics tracking
- **time-utils.ts**: Time calculations

## Development

### Install Dependencies

```bash
npm install
```

### Start Server (Development Mode)

```bash
npm run server
```

Server runs with tsx for TypeScript execution without build step.

### TypeScript Compilation (Production)

```bash
npm run build
```

Compiles TypeScript to JavaScript in preparation for production deployment.

### Code Quality

The codebase follows these principles:
- **No Duplication**: Common functionality extracted to shared utilities
- **Plugin-Agnostic Server**: Core server has zero plugin-specific code
- **Self-Contained Plugins**: Each plugin is fully independent
- **Comprehensive JSDoc**: All public APIs documented
- **Clean Separation**: Core utilities vs plugin-specific code clearly divided
- **Type Safety**: Full TypeScript coverage with strict mode

## Requirements

- Node.js 18 or higher
- npm or yarn package manager
- Honeywell EvoHome account (for EvoHome plugin)
- Valid API credentials configured in `plugins/evohome/config.json`

## Roadmap

**Completed**:
- ✅ Landing page with plugin overview
- ✅ Plugin-agnostic server architecture
- ✅ Self-contained plugin system
- ✅ Core utility libraries
- ✅ Collapsible navigation with state persistence
- ✅ Zone schedule viewer and editor
- ✅ Dynamic settings interface

**Planned**:
- [ ] Room boost/cool quick actions from dashboard
- [ ] Authentication/authorization for web UI
- [ ] Plugin installer/manager
- [ ] More device integrations (Hue, Nest, HomeKit, etc.)
- [ ] Mobile-responsive optimizations
- [ ] Push notifications for critical events
- [ ] Historical data graphs and analytics
- [ ] Configuration export/import
- [ ] Multi-user support
- [ ] REST API documentation with OpenAPI/Swagger

## License

ISC

## Credits

Created for personal home automation needs. Contributions welcome!

---

**Note**: This system is designed for local network use. Ensure proper security measures if exposing to the internet.

