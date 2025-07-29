import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
    @ApiPropertyOptional({
        description: 'Username',
        example: 'EcoWarrior',
        maxLength: 20
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    username?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'user@mokuen.com'
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        description: 'Profile image URL',
        example: 'https://example.com/avatar.jpg'
    })
    @IsOptional()
    @IsString()
    profileImage?: string;

    @ApiPropertyOptional({
        description: 'User bio',
        example: 'Passionate about reforestation',
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;
}