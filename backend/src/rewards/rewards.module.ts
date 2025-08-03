import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [RpcModule],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}