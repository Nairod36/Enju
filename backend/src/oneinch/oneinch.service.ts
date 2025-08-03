import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface SwapQuote {
  toAmount: string;
  tx: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

@Injectable()
export class OneInchService {
  private readonly logger = new Logger(OneInchService.name);
  private readonly apiClient: AxiosInstance;
  private readonly baseUrl = 'https://api.1inch.dev/swap/v6.0/1'; // Ethereum mainnet
  private readonly localRpcUrl = process.env.ETH_RPC_URL || 'https://vps-4d90b2ac.vps.ovh.net/rpc';

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INCH_API_KEY}`,
      },
    });

    // Add request interceptor for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making request to ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('API error:', error.response?.data || error.message);
        throw new HttpException(
          `1inch API error: ${error.response?.data?.message || error.message}`,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      },
    );
  }

  async getQuote(
    src: string,
    dst: string,
    amount: string,
    fee?: string,
    slippage?: number,
  ): Promise<SwapQuote> {
    try {
      const params = {
        src,
        dst,
        amount,
        includeTokensInfo: 'true',
        includeProtocols: 'true',
        includeGas: 'true',
        ...(fee && { fee }),
        ...(slippage && { slippage: slippage.toString() }),
      };

      this.logger.debug('Getting quote with params:', params);

      const response = await this.apiClient.get('/quote', { params });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get quote:', error);
      throw error;
    }
  }

  async getSwap(
    src: string,
    dst: string,
    amount: string,
    from: string,
    slippage: number = 1,
    fee?: string,
  ): Promise<SwapQuote> {
    try {
      const params = {
        src,
        dst,
        amount,
        from,
        slippage: slippage.toString(),
        disableEstimate: 'true', // Désactive la validation de balance
        allowPartialFill: 'false',
        skipValidation: 'true', // Skip balance validation for local fork
        ...(fee && { fee }),
      };

      this.logger.debug('Getting swap data with params:', params);

      const response = await this.apiClient.get('/swap', { params });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get swap data:', error);
      throw error;
    }
  }

  async getTokens(): Promise<Record<string, TokenInfo>> {
    try {
      this.logger.debug('Fetching supported tokens');

      const response = await this.apiClient.get('/tokens');
      return response.data.tokens;
    } catch (error) {
      this.logger.error('Failed to get tokens:', error);
      throw error;
    }
  }

  async getHealthCheck(): Promise<{ status: string; timestamp: number }> {
    try {
      // Simple health check by fetching tokens
      await this.getTokens();
      return {
        status: 'healthy',
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
      };
    }
  }
}

// Token addresses for common tokens
export const TOKENS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC real address
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
} as const;