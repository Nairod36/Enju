import { Controller, Post, Body, Get, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('connect')
  async connectWallet(@Body() body: { address: string; signature?: string; message?: string }) {
    return this.authService.connectWallet(body.address, body.signature, body.message);
  }

  @Post('update-username')
  async updateUsername(@Body() body: { address: string; username: string; signature?: string; message?: string }) {
    return this.authService.updateUsername(body.address, body.username, body.signature, body.message);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const address = req.user?.['address'];
    if (!address) {
      throw new BadRequestException('User address not found in token');
    }
    return this.authService.getProfile(address);
  }
}