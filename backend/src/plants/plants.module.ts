import { Module } from '@nestjs/common';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PlantsController],
    providers: [PlantsService],
    exports: [PlantsService],
})
export class PlantsModule { }