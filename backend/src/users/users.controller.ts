import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
  UseGuards,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectWalletDto, UpdateUserProfileDto } from './dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('check-exists')
  @ApiOperation({
    summary: 'Check if user exists',
    description: 'Check if a user exists by wallet address'
  })
  @ApiResponse({ status: 200, description: 'User existence check completed' })
  async checkUserExists(@Query('address') address: string) {
    return this.usersService.checkUserExists(address);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get my profile',
    description: 'Get authenticated user profile with biome info'
  })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getMyProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Get('profile/:walletAddress')
  @ApiOperation({
    summary: 'Get public user profile',
    description: 'Get public user profile by wallet address'
  })
  @ApiParam({ name: 'walletAddress', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'Public profile retrieved successfully' })
  async getPublicProfile(@Param('walletAddress') walletAddress: string) {
    return this.usersService.getPublicUserByAddress(walletAddress);
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get leaderboard',
    description: 'Get users ranked by activity score and biome health'
  })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  @Post('nonce')
  @ApiOperation({
    summary: 'Generate nonce',
    description: 'Generate nonce for wallet authentication'
  })
  @ApiResponse({ status: 201, description: 'Nonce generated successfully' })
  async generateNonce(@Body() body: { walletAddress: string }) {
    return this.usersService.generateNonce(body.walletAddress);
  }

  @Post('connect')
  @ApiOperation({
    summary: 'Connect wallet',
    description: 'Connect or create user account with wallet'
  })
  @ApiResponse({ status: 201, description: 'Wallet connected successfully' })
  async connectWallet(@Body() connectWalletDto: ConnectWalletDto) {
    return this.usersService.connectWallet(connectWalletDto);
  }

  @Post('me/update')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update my profile',
    description: 'Update user profile information'
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserProfileDto) {
    return this.usersService.updateProfile(req.user.id, updateUserDto);
  }
}