import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { IslandsModule } from './islands/islands.module';
import { BridgeModule } from './bridge/bridge.module';
import { OneInchModule } from './oneinch/oneinch.module';
import { RpcModule } from './rpc/rpc.module';
import { HealthController } from './health/health.controller';
import { HealthCronService } from './health/health-cron.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UsersModule,
    TransactionsModule,
    IslandsModule,
    BridgeModule,
    OneInchModule,
    RpcModule
  ],
  controllers: [HealthController],
  providers: [PrismaService, HealthCronService],
  exports: [PrismaService],
})
export class AppModule { }