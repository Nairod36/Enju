import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { OneinchModule } from '../oneinch/oneinch.module';

@Module({
  imports: [OneinchModule],
  controllers: [BridgeController],
  providers: [BridgeService],
  exports: [BridgeService]
})
export class BridgeModule {}