import { Module } from '@nestjs/common';
import { EscrowEventService } from './escrow-event.service';
import { EscrowEventController } from './escrow-event.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EscrowEventController],
  providers: [EscrowEventService, PrismaService],
  exports: [EscrowEventService],
})
export class EscrowEventModule {}
