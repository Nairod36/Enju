import { Module } from '@nestjs/common';
import { BiomesService } from './biomes.service';
import { BiomesController } from './biomes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [BiomesController],
    providers: [BiomesService],
    exports: [BiomesService],
})
export class BiomesModule { }