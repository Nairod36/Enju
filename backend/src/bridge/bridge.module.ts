import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';

@Module({
  controllers: [BridgeController],
  providers: [BridgeService],
  exports: [BridgeService]
})
export class BridgeModule {}