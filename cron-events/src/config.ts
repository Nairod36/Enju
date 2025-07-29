import winston from 'winston';
import dotenv from 'dotenv';
import { Config } from './types';

// Load environment variables
dotenv.config();

export const config: Config = {
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
  backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:3001',
  escrowFactoryAddress: process.env.ESCROW_FACTORY_ADDRESS || '0x14835B093D320AA5c9806BBC64C17F0F2546D9EE',
  pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10),
  blockLookback: parseInt(process.env.BLOCK_LOOKBACK || '1000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  apiTimeoutMs: parseInt(process.env.API_TIMEOUT_MS || '10000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
};

// Logger configuration
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'escrow-event-monitor' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
