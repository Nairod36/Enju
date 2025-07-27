import { Module } from '@nestjs/common';
import { IslandsController } from './islands.controller';
import { IslandsService } from './islands.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IslandsController],
  providers: [IslandsService],
  exports: [IslandsService]
})
export class IslandsModule {}