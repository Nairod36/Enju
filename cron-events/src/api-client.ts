import axios, { AxiosResponse } from 'axios';
import { config, logger } from './config';
import { EscrowEventData, ApiResponse } from './types';

export class BackendApiClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor() {
    this.baseUrl = config.backendApiUrl;
    this.timeout = config.apiTimeoutMs;
    this.maxRetries = config.maxRetries;
  }

  /**
   * Send escrow events to the backend API
   */
  async sendEvents(events: EscrowEventData[]): Promise<boolean> {
    if (events.length === 0) {
      logger.debug('No events to send to backend');
      return true;
    }

    try {
      logger.info(`Sending ${events.length} events to backend API`);

      for (const event of events) {
        await this.sendSingleEvent(event);
      }

      logger.info(`Successfully sent all ${events.length} events to backend`);
      return true;
    } catch (error) {
      logger.error('Error sending events to backend:', error);
      return false;
    }
  }

  private async sendSingleEvent(event: EscrowEventData): Promise<void> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<ApiResponse> = await axios.post(
          `${this.baseUrl}/escrow-events`,
          event,
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.success) {
          logger.debug(`Successfully sent event ${event.txHash} on attempt ${attempt}`);
          return;
        } else {
          throw new Error(`API returned error: ${response.data.error}`);
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${this.maxRetries} failed for event ${event.txHash}:`, error);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(`Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to send event ${event.txHash} after ${this.maxRetries} attempts: ${lastError}`);
  }

  /**
   * Get recent events from the backend
   */
  async getRecentEvents(limit: number = 50): Promise<EscrowEventData[]> {
    try {
      const response: AxiosResponse<ApiResponse<EscrowEventData[]>> = await axios.get(
        `${this.baseUrl}/escrow-events?limit=${limit}`,
        { timeout: this.timeout }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(`API returned error: ${response.data.error}`);
      }
    } catch (error) {
      logger.error('Error fetching recent events from backend:', error);
      return [];
    }
  }

  /**
   * Trigger manual event processing on the backend
   */
  async triggerEventProcessing(): Promise<boolean> {
    try {
      const response: AxiosResponse<ApiResponse> = await axios.post(
        `${this.baseUrl}/escrow-events/process-events`,
        {},
        { timeout: this.timeout }
      );

      return response.data.success;
    } catch (error) {
      logger.error('Error triggering backend event processing:', error);
      return false;
    }
  }

  /**
   * Health check for the backend API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response: AxiosResponse<ApiResponse> = await axios.get(
        `${this.baseUrl}/escrow-events/health`,
        { timeout: this.timeout }
      );

      return response.data.success;
    } catch (error) {
      logger.error('Backend health check failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
