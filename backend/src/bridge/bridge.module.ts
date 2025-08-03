import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  controllers: [BridgeController],
  providers: [BridgeService],
  exports: [BridgeService]
})
export class BridgeModule {}