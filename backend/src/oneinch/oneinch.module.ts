import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OneinchService } from './oneinch.service';
import { OneinchController } from './oneinch.controller';

@Module({
  imports: [ConfigModule],
  controllers: [OneinchController],
  providers: [OneinchService],
  exports: [OneinchService],
})
export class OneinchModule {}