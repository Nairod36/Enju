import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BiomesService } from './biomes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('biomes')
@Controller('biomes')
export class BiomesController {
    constructor(private readonly biomesService: BiomesService) { }

    @Get('me')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get my biome',
        description: 'Get the authenticated user forest biome with all trees'
    })
    @ApiResponse({ status: 200, description: 'Biome retrieved successfully' })
    async getMyBiome(@Request() req) {
        return this.biomesService.getUserBiome(req.user.id);
    }

    @Get('public/:walletAddress')
    @ApiOperation({
        summary: 'Get public biome by wallet address',
        description: 'Get public forest biome data for any user'
    })
    @ApiParam({ name: 'walletAddress', description: 'User wallet address' })
    @ApiResponse({ status: 200, description: 'Public biome data retrieved' })
    async getPublicBiome(@Param('walletAddress') walletAddress: string) {
        return this.biomesService.getPublicBiome(walletAddress);
    }

    @Post('activity')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Update user activity',
        description: 'Manually trigger activity update and tree growth'
    })
    @ApiResponse({ status: 200, description: 'Activity updated and trees may have grown' })
    async updateActivity(@Request() req) {
        const user = await this.biomesService.updateUserActivity(req.user.id, 15);
        return {
            message: 'Activity updated! Your trees may have grown.',
            newActivityScore: user.activityScore,
        };
    }

    @Post('admin/degradation')
    @ApiOperation({
        summary: 'Process degradation (admin)',
        description: 'Manually trigger degradation process for inactive users'
    })
    @ApiResponse({ status: 200, description: 'Degradation processed' })
    async processDegradation() {
        // En production, ceci devrait être protégé par une authentification admin
        const result = await this.biomesService.processDegradation();
        return { message: result };
    }
}