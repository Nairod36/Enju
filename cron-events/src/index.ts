import { EscrowEventMonitor } from './monitor';
import { logger } from './config';

async function main() {
  try {
    logger.info('='.repeat(50));
    logger.info('🚀 Starting UniteDeFi Escrow Event Monitor');
    logger.info('='.repeat(50));

    const monitor = new EscrowEventMonitor();
    
    // Start the monitoring service
    await monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });

    // Keep the process running
    logger.info('Monitor is running. Press Ctrl+C to stop.');
    
    // Optional: Set up a simple HTTP endpoint for manual triggers and status
    if (process.env.ENABLE_HTTP_API === 'true') {
      await setupHttpApi(monitor);
    }

  } catch (error) {
    logger.error('Failed to start escrow event monitor:', error);
    process.exit(1);
  }
}

async function setupHttpApi(monitor: EscrowEventMonitor) {
  const http = require('http');
  const url = require('url');

  const server = http.createServer(async (req: any, res: any) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;

    res.setHeader('Content-Type', 'application/json');

    if (path === '/trigger' && req.method === 'POST') {
      try {
        await monitor.manualTrigger();
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Trigger completed' }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    } else if (path === '/status' && req.method === 'GET') {
      try {
        const status = monitor.getStatus();
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: status }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
    }
  });

  const port = process.env.HTTP_PORT || 3002;
  server.listen(port, () => {
    logger.info(`HTTP API listening on port ${port}`);
    logger.info(`- POST /trigger - Manual trigger`);
    logger.info(`- GET /status - Get status`);
  });
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});
