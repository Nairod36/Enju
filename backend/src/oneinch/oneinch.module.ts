import { Module } from '@nestjs/common';
import { OneInchController } from './oneinch.controller';
import { OneInchService } from './oneinch.service';

@Module({
  controllers: [OneInchController],
  providers: [OneInchService],
  exports: [OneInchService],
})
export class OneInchModule {}