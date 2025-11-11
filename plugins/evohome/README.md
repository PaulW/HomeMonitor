# EvoHome Plugin

Monitoring and control plugin for Honeywell EvoHome heating systems.

## Features

- Real-time zone temperature monitoring
- Zone override control with blocking rules
- DHW (Domestic Hot Water) boost control
- Schedule management with visual timeline
- Automatic override reset based on time windows
- API rate limit protection

## Configuration

Configuration is stored in the centralized config system. Key settings:

### Credentials
- `username`: Your Honeywell Total Connect Comfort account email
- `password`: Your account password

### Settings
- `dhwSetTemp`: Default DHW temperature (°C)
- `boostTemp`: Temperature boost amount (0.5-3.0°C, default 1.5)
- `mockMode`: Enable mock data for local testing (optional, default false)

### Polling Intervals
- `zoneStatus`: Zone temperature polling (1-5 minutes, default 5)
- `overrideReset`: Override reset check (5-15 minutes, default 5)
- `scheduleRefresh`: Schedule refresh (30-60 minutes, default 30)

### Override Rules
Configure time-based override blocking per room:
- `roomName`: Name of the room
- `allowOverride`: Enable blocking (false = always allow)
- `timeWindows`: Array of blocked time windows (when overrides are NOT allowed)

## Mock Mode

For local development and testing, you can enable mock mode to avoid hitting API rate limits and database operations:

### Enabling Mock Mode

**Method 1: Environment Variable (Recommended)**

Set the environment variable when starting the server:

```bash
HM_MOCK_MODE=true npm run server
```

This will:
- ✅ **Prevent database file creation** (`data/home-monitor.db` will not be created)
- ✅ Use simulated mock configuration (doesn't touch database)
- ✅ Skip database operations entirely
- ✅ Use mock API client for all EvoHome operations
- ✅ Skip authentication (no API rate limits)
- ✅ Skip polling operations (mock data is static)
- ✅ Allow config changes during runtime (not persisted)

**Method 2: Configuration File**

Add to your configuration:

```json
{
  "settings": {
    "dhwSetTemp": 50.0,
    "boostTemp": 1.5,
    "mockMode": true
  }
}
```

⚠️ **Note:** Environment variable method is preferred as it completely bypasses the database.

### Mock Configuration

When mock mode is enabled, a default configuration is generated with:

**Settings:**
- DHW Set Temperature: 50.0°C
- Boost Temperature: 1.5°C
- Polling intervals: 5/5/30 minutes

**Override Rules:**
- Living Room: Blocking enabled (weekdays 09:00-17:00)
- Kitchen: Blocking disabled
- Bathroom: Blocking enabled (weekdays 08:00-18:00)
- Bedroom: Blocking disabled

You can modify these rules through the UI, but changes won't be persisted to the database.

### Mock Data

Mock mode provides simulated data for 5 zones:
- **Hot Water** (DHW)
- **Living Room** (21°C comfort)
- **Kitchen** (19.5°C)
- **Bathroom** (22.5°C warm)
- **Bedroom** (18°C economy)

#### Features in Mock Mode:
- ✅ Realistic temperature variations
- ✅ Simulated schedules for all zones
- ✅ Override control (simulated)
- ✅ DHW boost/cancel (simulated)
- ✅ API latency simulation (300-500ms)
- ❌ No real API calls
- ❌ Changes not persisted

Mock mode is ideal for:
- Local development without production system access
- Testing UI changes without API rate limits
- Demonstrating the system without real hardware
- CI/CD testing

## API Documentation

The plugin uses two Honeywell APIs:
- **V1 API**: Schedule management, DHW control
- **V2 API**: Zone status, temperature overrides

See `docs/API_ANALYSIS.md` for detailed API documentation.

## Development

### Project Structure

```
plugins/evohome/
├── index.ts                   # Plugin entry point
├── routes.ts                  # Express routes
├── config-schema.ts           # JSON schema for UI validation
├── centralized-config-schema.ts # Schema for centralized config system
├── README.md                  # This file
├── api/                       # API clients
│   ├── auth-manager.ts        # Authentication handling
│   ├── v1-api.ts              # V1 API client (schedules, DHW)
│   ├── v2-api.ts              # V2 API client (zones, overrides)
│   ├── mock-api-client.ts     # Mock V2 API for testing
│   ├── mock-v1-api-client.ts  # Mock V1 API for testing
│   ├── mock-data.ts           # Mock data generator
│   └── constants.ts           # API constants
├── services/                  # Business logic
│   ├── zone-service.ts        # Zone status management
│   ├── override-service.ts    # Override management
│   ├── schedule-service.ts    # Schedule management
│   ├── device-cache-service.ts # Device caching
│   └── api-stats-tracker.ts   # API statistics tracking
├── types/                     # TypeScript interfaces
│   ├── api.types.ts           # API response types
│   ├── config.types.ts        # Configuration types
│   ├── schedule.types.ts      # Schedule types
│   └── zone.types.ts          # Zone types
├── utils/                     # Plugin-specific utilities
│   ├── logger.ts              # Logger wrapper
│   ├── http.ts                # HTTP utilities
│   └── service-initializer.ts # Service factory/initialization
├── web/                       # Frontend assets
│   ├── css/
│   │   └── evohome.css        # Plugin styles
│   ├── js/                    # Client-side JavaScript
│   │   ├── evohome-utils.js
│   │   ├── evohome-dashboard-display.js
│   │   ├── evohome-override-control.js
│   │   ├── evohome-scheduler.js
│   │   ├── evohome-settings.js
│   │   └── evohome-status.js
│   └── templates/             # HTML templates
│       ├── dashboard.html
│       ├── override-control.html
│       ├── scheduler.html
│       ├── settings.html
│       └── status.html
```

### Testing

Run with mock mode enabled:
```bash
npm run server
```

Access at: `http://localhost:8080/plugin/evohome`

## Troubleshooting

### API Rate Limits
If you encounter rate limit errors, increase polling intervals or enable mock mode for development.

### Failed Sensors
Zones showing 128°C indicate failed/unavailable temperature sensors.

### Override Not Resetting
Check override rules configuration and ensure time windows are correctly defined.
