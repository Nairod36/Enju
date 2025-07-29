// src/users/dto/public-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserDto {
    @ApiPropertyOptional({
        description: 'Username',
        example: 'EcoWarrior'
    })
    username?: string;

    @ApiProperty({
        description: 'Wallet address',
        example: '0x742d35Cc6634C0532925a3b8D4C0d4e3aeC6C31c'
    })
    walletAddress: string;

    @ApiProperty({
        description: 'Activity score (public)',
        example: 1250
    })
    activityScore: number;

    @ApiProperty({
        description: 'Last activity timestamp',
        example: '2024-01-15T10:30:00Z'
    })
    lastActivityAt: Date;

    @ApiProperty({
        description: 'User level',
        example: 15
    })
    level: number;

    @ApiProperty({
        description: 'Experience points',
        example: 2450
    })
    experience: number;

    @ApiPropertyOptional({
        description: 'Profile image URL',
        example: 'https://example.com/avatar.jpg'
    })
    profileImage?: string;

    @ApiPropertyOptional({
        description: 'User bio',
        example: 'Passionate about reforestation'
    })
    bio?: string;

    @ApiProperty({
        description: 'Connection status',
        example: true
    })
    isConnected: boolean;

    @ApiProperty({
        description: 'User creation date',
        example: '2024-01-15T10:30:00Z'
    })
    createdAt: Date;

    @ApiPropertyOptional({
        description: 'Active island information (public)',
        type: 'object',
        properties: {
            name: { type: 'string', example: 'Île Tropicale' },
            description: { type: 'string', example: 'Une île paradisiaque et productive' },
            totalTrees: { type: 'number', example: 25 },
            healthScore: { type: 'number', example: 95.5 },
            lastUpdateAt: { type: 'string', example: '2024-01-15T10:30:00Z' }
        }
    })
    island?: {
        name: string;
        description?: string;
        totalTrees: number;
        healthScore: number;
        lastUpdateAt: Date;
    };
}