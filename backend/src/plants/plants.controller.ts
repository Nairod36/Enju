import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete, Put, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { PlantsService } from './plants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlantDto, UpdatePlantDto, MoveePlantDto } from './dto';

@ApiTags('plants')
@Controller('plants')
export class PlantsController {
    constructor(private readonly plantsService: PlantsService) { }

    @Get('me')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get my plants',
        description: 'Get all plants in my biome with their positions'
    })
    @ApiResponse({ status: 200, description: 'Plants retrieved successfully' })
    async getMyPlants(@Request() req) {
        return this.plantsService.getUserPlants(req.user.id);
    }

    @Get('public/:walletAddress')
    @ApiOperation({
        summary: 'Get public plants by wallet address',
        description: 'Get all plants in a public biome with their positions'
    })
    @ApiParam({ name: 'walletAddress', description: 'User wallet address' })
    @ApiResponse({ status: 200, description: 'Public plants retrieved' })
    async getPublicPlants(@Param('walletAddress') walletAddress: string) {
        return this.plantsService.getPublicPlants(walletAddress);
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Plant a new plant',
        description: 'Plant a new plant at specific x/y coordinates in my biome'
    })
    @ApiBody({ type: CreatePlantDto })
    @ApiResponse({ status: 201, description: 'Plant created successfully' })
    async createPlant(@Request() req, @Body() createPlantDto: CreatePlantDto) {
        return this.plantsService.createPlant(req.user.id, createPlantDto);
    }

    @Put(':id/move')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Move a plant',
        description: 'Move a plant to new x/y coordinates'
    })
    @ApiParam({ name: 'id', description: 'Plant ID' })
    @ApiBody({ type: MoveePlantDto })
    @ApiResponse({ status: 200, description: 'Plant moved successfully' })
    async movePlant(@Request() req, @Param('id') id: string, @Body() movePlantDto: MoveePlantDto) {
        return this.plantsService.movePlant(req.user.id, id, movePlantDto);
    }

    @Put(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Update a plant',
        description: 'Update plant name or other properties'
    })
    @ApiParam({ name: 'id', description: 'Plant ID' })
    @ApiBody({ type: UpdatePlantDto })
    @ApiResponse({ status: 200, description: 'Plant updated successfully' })
    async updatePlant(@Request() req, @Param('id') id: string, @Body() updatePlantDto: UpdatePlantDto) {
        return this.plantsService.updatePlant(req.user.id, id, updatePlantDto);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Remove a plant',
        description: 'Remove a plant from my biome'
    })
    @ApiParam({ name: 'id', description: 'Plant ID' })
    @ApiResponse({ status: 200, description: 'Plant removed successfully' })
    async removePlant(@Request() req, @Param('id') id: string) {
        return this.plantsService.removePlant(req.user.id, id);
    }

    @Get('grid/:walletAddress')
    @ApiOperation({
        summary: 'Get biome grid',
        description: 'Get a 2D grid representation of plants in a biome'
    })
    @ApiParam({ name: 'walletAddress', description: 'User wallet address' })
    @ApiResponse({ status: 200, description: 'Grid retrieved successfully' })
    async getBiomeGrid(@Param('walletAddress') walletAddress: string) {
        return this.plantsService.getBiomeGrid(walletAddress);
    }

    @Post(':id/water')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Water a plant',
        description: 'Water a plant to improve its health'
    })
    @ApiParam({ name: 'id', description: 'Plant ID' })
    @ApiResponse({ status: 200, description: 'Plant watered successfully' })
    async waterPlant(@Request() req, @Param('id') id: string) {
        return this.plantsService.waterPlant(req.user.id, id);
    }
}