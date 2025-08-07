import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { IslandsModule } from './islands/islands.module';
import { BridgeModule } from './bridge/bridge.module';
import { OneInchModule } from './oneinch/oneinch.module';
import { RpcModule } from './rpc/rpc.module';
import { RewardsModule } from './rewards/rewards.module';
import { HealthController } from './health/health.controller';
import { HealthCronService } from './health/health-cron.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../.env'),
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // Max 100 requêtes par minute par IP
    }]),
    UsersModule,
    TransactionsModule,
    IslandsModule,
    BridgeModule,
    OneInchModule,
    RpcModule,
    RewardsModule
  ],
  controllers: [HealthController],
  providers: [
    PrismaService, 
    HealthCronService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService],
})
export class AppModule { }