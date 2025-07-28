import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Connected to NEON database');

      // Configuration optimisée pour NEON
      await this.$executeRaw`SET statement_timeout = '30s'`;
      await this.$executeRaw`SET lock_timeout = '10s'`;
      await this.$executeRaw`SET idle_in_transaction_session_timeout = '2min'`;

    } catch (error) {
      this.logger.error('❌ Failed to connect to NEON database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('📤 Disconnected from NEON database');
  }

  // Helper pour les transactions avec retry (utile avec NEON serverless)
  async transactionWithRetry<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.$transaction(fn, {
          timeout: 20000,
        });
      } catch (error) {
        lastError = error;

        if (
          error.code === 'P2034' ||
          error.code === 'P1001' ||
          error.message.includes('connection') ||
          error.message.includes('timeout')
        ) {
          const backoffTime = Math.pow(2, i) * 1000;
          this.logger.warn(`Transaction failed, retrying in ${backoffTime}ms (attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  // Health check pour NEON
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw new Error('Database health check failed');
    }
  }
}