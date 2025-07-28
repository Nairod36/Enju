import { PublicUserDto, UserResponseDto } from "./dto";
import { plainToClass } from "class-transformer";

export class UsersUtils {
    constructor() { }

    public transformToResponseDto(user: any): UserResponseDto {
        return plainToClass(UserResponseDto, user, {
            excludeExtraneousValues: false,
        });
    }

    public transformToPublicDto(user: any): PublicUserDto {
        return {
            username: user.username,
            walletAddress: user.walletAddress,
            activityScore: user.activityScore,
            lastActivityAt: user.lastActivityAt,
            level: user.level,
            experience: user.experience,
            profileImage: user.profileImage,
            bio: user.bio,
            isConnected: user.isConnected,
            createdAt: user.createdAt,
            biome: user.biome ? {
                name: user.biome.name,
                description: user.biome.description,
                totalTrees: user.biome.totalTrees,
                healthScore: parseFloat(user.biome.healthScore.toString()),
                lastUpdateAt: user.biome.lastUpdateAt,
            } : undefined,
        };
    }
}