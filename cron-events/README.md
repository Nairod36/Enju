# UniteDeFi Escrow Event Monitor

A standalone cronjob service that monitors 1inch Fusion+ escrow events and sends them to the backend API.

## Features

- ✅ Real-time monitoring of EscrowFactory events
- ✅ Automatic event processing every 30 seconds
- ✅ Retry logic with exponential backoff
- ✅ Health checks and logging
- ✅ Manual trigger endpoints
- ✅ Graceful error handling

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Configuration

Environment variables in `.env`:

```env
# Blockchain Configuration
ETHEREUM_RPC_URL=http://127.0.0.1:8545
ESCROW_FACTORY_ADDRESS=0x14835B093D320AA5c9806BBC64C17F0F2546D9EE

# Backend API
BACKEND_API_URL=http://localhost:3001

# Monitoring Settings
POLL_INTERVAL_SECONDS=30
BLOCK_LOOKBACK=1000
LOG_LEVEL=info

# API Settings
API_TIMEOUT_MS=10000
MAX_RETRIES=3

# Optional HTTP API
ENABLE_HTTP_API=true
HTTP_PORT=3002
```

## Architecture

The service consists of several components:

1. **EscrowEventListener** - Monitors blockchain events
2. **BackendApiClient** - Communicates with backend API
3. **EscrowEventMonitor** - Orchestrates the monitoring process

## Events Monitored

- `SrcEscrowCreated` - Source chain escrow creation
- `DstEscrowCreated` - Destination chain escrow creation

## API Integration

The service expects the backend to have these endpoints:

- `POST /escrow-events` - Accept new events
- `GET /escrow-events` - Get recent events
- `POST /escrow-events/process-events` - Manual trigger
- `GET /escrow-events/health` - Health check

## Manual Controls

If `ENABLE_HTTP_API=true`, you can:

```bash
# Manual trigger
curl -X POST http://localhost:3002/trigger

# Check status
curl http://localhost:3002/status
```

## Logs

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Deployment

1. Build the project: `npm run build`
2. Set production environment variables
3. Run: `npm start`
4. Monitor logs for any issues

## Integration with UniteDeFi Backend

This service replaces the frontend's direct blockchain monitoring to prevent API spam and timeouts. It:

1. Monitors blockchain events continuously
2. Processes and formats event data
3. Sends events to the backend database
4. Provides fallback and retry mechanisms

The frontend can then call the backend API to get events instead of monitoring the blockchain directly.
