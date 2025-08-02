import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async connectWallet(address: string, signature?: string, message?: string) {
    if (!ethers.utils.isAddress(address)) {
      throw new BadRequestException('Invalid wallet address');
    }

    // Vérifier la signature si fournie (optionnel)
    if (signature && message) {
      try {
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          throw new BadRequestException('Invalid signature');
        }
      } catch (error) {
        throw new BadRequestException('Failed to verify signature');
      }
    }

    // Créer ou mettre à jour l'utilisateur
    const user = await this.prisma.user.upsert({
      where: { walletAddress: address.toLowerCase() },
      update: {
        lastLoginAt: new Date(),
        isConnected: true,
      },
      create: {
        walletAddress: address.toLowerCase(),
        isConnected: true,
        lastLoginAt: new Date(),
      },
    });

    // Générer JWT token
    const token = this.jwtService.sign({ 
      sub: user.id, 
      address: user.walletAddress 
    });

    return {
      success: true,
      user: {
        id: user.id,
        address: user.walletAddress,
        username: user.username,
        createdAt: user.createdAt,
      },
      token,
      message: signature ? 'Wallet connected and verified' : 'Wallet connected (no signature verification)'
    };
  }

  async updateUsername(address: string, username: string, signature?: string, message?: string) {
    if (!ethers.utils.isAddress(address)) {
      throw new BadRequestException('Invalid wallet address');
    }

    if (!username || username.trim().length < 3) {
      throw new BadRequestException('Username must be at least 3 characters long');
    }

    // Vérifier la signature si fournie (optionnel)
    if (signature && message) {
      try {
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          throw new BadRequestException('Invalid signature');
        }
      } catch (error) {
        throw new BadRequestException('Failed to verify signature');
      }
    }

    // Vérifier si le username est déjà pris
    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: username.trim(),
        NOT: {
          walletAddress: address.toLowerCase()
        }
      }
    });

    if (existingUser) {
      throw new BadRequestException('Username already taken');
    }

    // Mettre à jour l'utilisateur
    const user = await this.prisma.user.update({
      where: { walletAddress: address.toLowerCase() },
      data: {
        username: username.trim(),
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        address: user.walletAddress,
        username: user.username,
        updatedAt: user.updatedAt,
      },
      message: 'Username updated successfully'
    };
  }

  async getProfile(address: string) {
    if (!address) {
      throw new BadRequestException('Address is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        activityScore: true,
        level: true,
        experience: true,
        tokenBalance: true,
      }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      success: true,
      user
    };
  }
}