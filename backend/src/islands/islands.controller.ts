import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IslandsService } from './islands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateIslandDto, UpdateIslandDto, IslandResponseDto } from './dto';

@ApiTags('islands')
@Controller('islands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class IslandsController {
  constructor(private readonly islandsService: IslandsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new island',
    description: 'Create a new island for the authenticated user'
  })
  @ApiResponse({ status: 201, description: 'Island created successfully', type: IslandResponseDto })
  async createIsland(@Request() req, @Body() createIslandDto: CreateIslandDto): Promise<IslandResponseDto> {
    return this.islandsService.createIsland(req.user.id, createIslandDto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Get my islands',
    description: 'Get all islands belonging to the authenticated user'
  })
  @ApiResponse({ status: 200, description: 'Islands retrieved successfully', type: [IslandResponseDto] })
  async getMyIslands(@Request() req): Promise<IslandResponseDto[]> {
    return this.islandsService.getUserIslands(req.user.id);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active island',
    description: 'Get the currently active island for the authenticated user'
  })
  @ApiResponse({ status: 200, description: 'Active island retrieved successfully', type: IslandResponseDto })
  async getActiveIsland(@Request() req): Promise<IslandResponseDto | null> {
    return this.islandsService.getActiveIsland(req.user.id);
  }

  @Get('ensure')
  @ApiOperation({
    summary: 'Ensure user has an island',
    description: 'Get user island or create one if none exists'
  })
  @ApiResponse({ status: 200, description: 'User island ensured', type: IslandResponseDto })
  async ensureUserHasIsland(@Request() req): Promise<IslandResponseDto> {
    return this.islandsService.ensureUserHasIsland(req.user.id);
  }

  @Get('by-seed/:seed')
  @ApiOperation({
    summary: 'Get islands by seed',
    description: 'Get all islands with a specific seed (public endpoint for exploration)'
  })
  @ApiParam({ name: 'seed', description: 'Island generation seed' })
  @ApiResponse({ status: 200, description: 'Islands retrieved successfully', type: [IslandResponseDto] })
  async getIslandsBySeed(@Param('seed') seed: string): Promise<IslandResponseDto[]> {
    return this.islandsService.getIslandsBySeed(parseInt(seed));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get island by ID',
    description: 'Get a specific island by its ID (must belong to authenticated user)'
  })
  @ApiParam({ name: 'id', description: 'Island ID' })
  @ApiResponse({ status: 200, description: 'Island retrieved successfully', type: IslandResponseDto })
  async getIslandById(@Request() req, @Param('id') id: string): Promise<IslandResponseDto> {
    return this.islandsService.getIslandById(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update island',
    description: 'Update an existing island'
  })
  @ApiParam({ name: 'id', description: 'Island ID' })
  @ApiResponse({ status: 200, description: 'Island updated successfully', type: IslandResponseDto })
  async updateIsland(
    @Request() req,
    @Param('id') id: string,
    @Body() updateIslandDto: UpdateIslandDto
  ): Promise<IslandResponseDto> {
    return this.islandsService.updateIsland(req.user.id, id, updateIslandDto);
  }

  @Put(':id/activate')
  @ApiOperation({
    summary: 'Set active island',
    description: 'Set an island as the active one for the user'
  })
  @ApiParam({ name: 'id', description: 'Island ID' })
  @ApiResponse({ status: 200, description: 'Island activated successfully', type: IslandResponseDto })
  async setActiveIsland(@Request() req, @Param('id') id: string): Promise<IslandResponseDto> {
    return this.islandsService.setActiveIsland(req.user.id, id);
  }

  @Put(':id/auto-save')
  @ApiOperation({
    summary: 'Auto-save island changes',
    description: 'Automatically save island modifications with timestamp updates'
  })
  @ApiParam({ name: 'id', description: 'Island ID' })
  @ApiResponse({ status: 200, description: 'Island auto-saved successfully', type: IslandResponseDto })
  async autoSaveIsland(
    @Request() req,
    @Param('id') id: string,
    @Body() updateIslandDto: UpdateIslandDto
  ): Promise<IslandResponseDto> {
    return this.islandsService.autoSaveIsland(req.user.id, id, updateIslandDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete island',
    description: 'Delete an island (cannot delete active island)'
  })
  @ApiParam({ name: 'id', description: 'Island ID' })
  @ApiResponse({ status: 200, description: 'Island deleted successfully' })
  async deleteIsland(@Request() req, @Param('id') id: string): Promise<{ message: string }> {
    await this.islandsService.deleteIsland(req.user.id, id);
    return { message: 'Island deleted successfully' };
  }
}