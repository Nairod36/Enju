import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';

export class UserResponseDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: 'clp2x5f6d0000...'
    })
    id: string;

    @ApiProperty({
        description: 'Wallet address',
        example: '0x742d35Cc6634C0532925a3b8D4C0d4e3aeC6C31c'
    })
    walletAddress: string;

    @ApiPropertyOptional({
        description: 'Username',
        example: 'EcoWarrior'
    })
    username?: string;

    @ApiPropertyOptional({
        description: 'Email (private)',
        example: 'user@Enju.com'
    })
    email?: string;

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

    @ApiProperty({
        description: 'Token balance',
        example: '1250.75000000'
    })
    tokenBalance: number;

    @ApiProperty({
        description: 'Number of completed bridges',
        example: 12
    })
    bridgeCount: number;

    @ApiProperty({
        description: 'Connection status',
        example: true
    })
    isConnected: boolean;

    @ApiProperty({
        description: 'Creation date',
        example: '2024-01-15T10:30:00Z'
    })
    createdAt: Date;

    @Exclude()
    nonce?: string;
}