import winston from 'winston';
import { config } from '../config';

/**
 * Logger centralisé pour tout le relayer
 */
export const createLogger = (service: string = 'relayer'): winston.Logger => {
  return winston.createLogger({
    level: config.monitoring.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.label({ label: service }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, label, message }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
          })
        )
      }),
      new winston.transports.File({ 
        filename: 'relayer.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ],
  });
};

// Logger par défaut
export const logger = createLogger();