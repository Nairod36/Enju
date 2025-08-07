import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NearController } from './near.controller';
import { NearService } from './near.service';

@Module({
    imports: [HttpModule],
    controllers: [NearController],
    providers: [NearService],
    exports: [NearService],
})
export class NearModule { }