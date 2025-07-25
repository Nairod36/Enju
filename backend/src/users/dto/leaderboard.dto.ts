import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LeaderboardDto {
    @ApiProperty({
        description: 'Rank position',
        example: 1
    })
    rank: number;

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
        description: 'Score for the leaderboard category',
        example: 1250
    })
    score: number;

    @ApiProperty({
        description: 'Category being ranked',
        enum: ['activity', 'trees', 'health'],
        example: 'activity'
    })
    category: string;

    @ApiPropertyOptional({
        description: 'Additional biome stats',
        type: 'object'
    })
    biomeStats?: {
        totalTrees: number;
        healthScore: number;
    };
}