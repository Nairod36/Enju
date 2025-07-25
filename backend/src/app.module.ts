import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { QuestsModule } from './quests/quests.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [UsersModule, TransactionsModule, QuestsModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}