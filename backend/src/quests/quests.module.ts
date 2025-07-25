import { Module } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { QuestsController } from './quests.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [QuestsController],
  providers: [QuestsService, PrismaService],
})
export class QuestsModule {}