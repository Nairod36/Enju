import * as cron from 'node-cron';
import { EscrowEventListener } from './event-listener';
import { BackendApiClient } from './api-client';
import { config, logger } from './config';

export class EscrowEventMonitor {
  private eventListener: EscrowEventListener;
  private apiClient: BackendApiClient;
  private isRunning: boolean = false;

  constructor() {
    this.eventListener = new EscrowEventListener();
    this.apiClient = new BackendApiClient();
  }

  /**
   * Start the monitoring service with scheduled tasks
   */
  async start(): Promise<void> {
    logger.info('Starting Escrow Event Monitor...');

    // Validate connection to blockchain and backend
    await this.validateConnections();

    // Schedule the main monitoring task
    const cronExpression = `*/${config.pollIntervalSeconds} * * * * *`; // Every N seconds
    
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        logger.debug('Previous task still running, skipping...');
        return;
      }

      await this.runMonitoringCycle();
    });

    logger.info(`Scheduled monitoring task to run every ${config.pollIntervalSeconds} seconds`);

    // Schedule a health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.runHealthCheck();
    });

    logger.info('Escrow Event Monitor started successfully');
  }

  /**
   * Run a single monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    this.isRunning = true;

    try {
      logger.debug('Starting monitoring cycle...');

      // 1. Fetch new events from blockchain
      const events = await this.eventListener.processNewEvents();

      if (events.length > 0) {
        logger.info(`Found ${events.length} new escrow events`);

        // 2. Send events to backend API
        const success = await this.apiClient.sendEvents(events);

        if (success) {
          logger.info(`Successfully processed ${events.length} events`);
        } else {
          logger.error(`Failed to send ${events.length} events to backend`);
        }
      } else {
        logger.debug('No new events found');
      }

    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Validate connections to blockchain and backend
   */
  private async validateConnections(): Promise<void> {
    try {
      logger.info('Validating connections...');

      // Test blockchain connection
      const currentBlock = await this.eventListener.getCurrentBlock();
      logger.info(`Connected to blockchain, current block: ${currentBlock}`);

      // Test backend API connection
      const backendHealthy = await this.apiClient.healthCheck();
      if (backendHealthy) {
        logger.info('Backend API is healthy');
      } else {
        logger.warn('Backend API health check failed - continuing anyway');
      }

    } catch (error) {
      logger.error('Connection validation failed:', error);
      throw error;
    }
  }

  /**
   * Run periodic health checks
   */
  private async runHealthCheck(): Promise<void> {
    try {
      logger.debug('Running health check...');

      const currentBlock = await this.eventListener.getCurrentBlock();
      const backendHealthy = await this.apiClient.healthCheck();

      logger.info(`Health check - Block: ${currentBlock}, Backend: ${backendHealthy ? 'OK' : 'FAIL'}`);

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Manual trigger for event processing
   */
  async manualTrigger(): Promise<void> {
    logger.info('Manual trigger requested');

    if (this.isRunning) {
      logger.warn('Monitor is already running, please wait...');
      return;
    }

    await this.runMonitoringCycle();
  }

  /**
   * Get current status
   */
  getStatus(): { isRunning: boolean; config: typeof config } {
    return {
      isRunning: this.isRunning,
      config
    };
  }
}
