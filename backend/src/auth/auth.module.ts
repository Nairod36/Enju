import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d' },
            }),
            inject: [ConfigService],
        }),
        PrismaModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [JwtModule, AuthService],
})
export class AuthModule { }