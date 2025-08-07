import { PublicUserDto, UserResponseDto } from "./dto";
import { plainToClass } from "class-transformer";

export class UsersUtils {
    constructor() { }

    public transformToResponseDto(user: any): UserResponseDto {
        // Transformation manuelle pour éviter les erreurs Decimal
        return {
            id: user.id,
            walletAddress: user.walletAddress,
            username: user.username,
            email: user.email,
            activityScore: user.activityScore,
            lastActivityAt: user.lastActivityAt,
            level: user.level,
            experience: user.experience,
            tokenBalance: user.tokenBalance ? parseFloat(user.tokenBalance.toString()) : 0,
            bridgeCount: user.bridgeCount || 0,
            isConnected: user.isConnected,
            createdAt: user.createdAt,
        };
    }

    public transformToPublicDto(user: any): PublicUserDto {
        const activeIsland = user.islands && user.islands[0];
        
        return {
            username: user.username,
            walletAddress: user.walletAddress,
            activityScore: user.activityScore,
            lastActivityAt: user.lastActivityAt,
            level: user.level,
            experience: user.experience,
            bridgeCount: user.bridgeCount || 0,
            profileImage: user.profileImage,
            bio: user.bio,
            isConnected: user.isConnected,
            createdAt: user.createdAt,
            island: activeIsland ? {
                name: activeIsland.name,
                description: activeIsland.description,
                totalTrees: activeIsland.totalTrees,
                healthScore: parseFloat(activeIsland.healthScore.toString()),
                lastUpdateAt: activeIsland.lastUpdateAt,
            } : undefined,
        };
    }
}