import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersUtils } from './users.utils';

@Module({
  controllers: [UsersController],
  imports: [PrismaModule, AuthModule],
  providers: [UsersService, PrismaService, UsersUtils],
  exports: [UsersService],
})
export class UsersModule { }