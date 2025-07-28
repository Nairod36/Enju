import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ethers } from 'ethers';
import { plainToClass } from 'class-transformer';
import {
  ConnectWalletDto,
  UpdateUserProfileDto,
  UserResponseDto,
  AuthResponseDto,
  NonceResponseDto,
  PublicUserDto,
  LeaderboardDto,

} from './dto'
import { UsersUtils } from './users.utils';
import {
  UserNotFoundException,
  InvalidWalletAddressException,
  InvalidSignatureException,
  NonceNotFoundException,
  UsernameAlreadyTakenException,
  EmailAlreadyTakenException
} from '../common/exceptions';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private usersUtils: UsersUtils,
  ) { }

  async generateNonce(walletAddress: string): Promise<NonceResponseDto> {
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new InvalidWalletAddressException();
    }

    const nonce = `nonce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message = `Please sign this message to authenticate with Mokuen SwapForest: ${nonce}`;

    await this.prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { nonce },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        nonce,
        isConnected: false,
      },
    });

    return { message, nonce };
  }

  async connectWallet(connectWalletDto: ConnectWalletDto): Promise<AuthResponseDto> {
    const { walletAddress, signature, message } = connectWalletDto;

    if (!ethers.utils.isAddress(walletAddress)) {
      throw new InvalidWalletAddressException();
    }

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user || !user.nonce) {
      throw new NonceNotFoundException();
    }

    const expectedMessage = `Please sign this message to authenticate with Mokuen SwapForest: ${user.nonce}`;
    if (message !== expectedMessage) {
      throw new InvalidSignatureException('Invalid message');
    }

    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new InvalidSignatureException('Invalid signature');
      }
    } catch (error) {
      throw new InvalidSignatureException('Invalid signature format');
    }

    const isNewUser = !user.isConnected && !user.lastLoginAt;

    // Utiliser une transaction pour créer user + biome si nouveau
    const result = await this.prisma.$transaction(async (prisma) => {
      const updatedUser = await prisma.user.update({
        where: { walletAddress: walletAddress.toLowerCase() },
        data: {
          isConnected: true,
          lastLoginAt: new Date(),
          lastActivityAt: new Date(),
          chainId: connectWalletDto.chainId || 1,
          nonce: null,
          ...(isNewUser && {
            level: 1,
            experience: 0,
            tokenBalance: 0,
            activityScore: 10, // Points de démarrage
          }),
        },
      });

      // Créer le biome initial si nouveau utilisateur
      if (isNewUser) {
        const biome = await prisma.biome.create({
          data: {
            userId: updatedUser.id,
            name: 'Ma Première Forêt',
            description: 'Le début de mon aventure forestière',
            totalTrees: 1,
          },
        });

        // Planter le premier arbre
        await prisma.plant.create({
          data: {
            biomeId: biome.id,
            name: 'Premier Arbre',
            species: 'SEEDLING',
            positionX: 5,
            positionY: 5,
            growthLevel: 1,
            health: 100,
          },
        });
      }

      return updatedUser;
    });

    const payload = {
      sub: result.id,
      walletAddress: result.walletAddress,
      username: result.username
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.usersUtils.transformToResponseDto(result),
      isNewUser,
    };
  }

  async disconnectWallet(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isConnected: false },
    });
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return this.usersUtils.transformToResponseDto(user);
  }

  async updateProfile(userId: string, updateData: UpdateUserProfileDto): Promise<UserResponseDto> {
    if (updateData.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: updateData.username, NOT: { id: userId } },
      });
      if (existing) {
        throw new UsernameAlreadyTakenException(updateData.username);
      }
    }

    if (updateData.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: updateData.email, NOT: { id: userId } },
      });
      if (existing) {
        throw new EmailAlreadyTakenException(updateData.email);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        lastActivityAt: new Date(), // Mettre à jour l'activité
        activityScore: { increment: 5 },
      },
    });

    return this.usersUtils.transformToResponseDto(updatedUser);
  }

  // MÉTHODES PUBLIQUES
  async getPublicUsers(limit: number = 20, sortBy: string = 'activity'): Promise<PublicUserDto[]> {
    let orderBy: any = { activityScore: 'desc' };

    if (sortBy === 'trees') {
      orderBy = { biome: { totalTrees: 'desc' } };
    } else if (sortBy === 'health') {
      orderBy = { biome: { healthScore: 'desc' } };
    }

    const users = await this.prisma.user.findMany({
      where: { isConnected: true },
      orderBy,
      take: limit,
      include: {
        biome: {
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
        },
      },
    });

    return users.map(user => this.usersUtils.transformToPublicDto(user));
  }

  async getLeaderboard(category: string = 'activity', limit: number = 10): Promise<LeaderboardDto[]> {
    let orderBy: any = { activityScore: 'desc' };

    if (category === 'trees') {
      orderBy = { biome: { totalTrees: 'desc' } };
    } else if (category === 'health') {
      orderBy = { biome: { healthScore: 'desc' } };
    }

    const users = await this.prisma.user.findMany({
      where: { isConnected: true },
      orderBy,
      take: limit,
      include: {
        biome: {
          select: {
            totalTrees: true,
            healthScore: true,
          },
        },
      },
    });

    return users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      walletAddress: user.walletAddress,
      score: category === 'activity' ? user.activityScore :
        category === 'trees' ? user.biome?.totalTrees || 0 :
          parseFloat(user.biome?.healthScore?.toString() || '0'),
      category,
      biomeStats: user.biome ? {
        totalTrees: user.biome.totalTrees,
        healthScore: parseFloat(user.biome.healthScore.toString()),
      } : undefined,
    }));
  }

  async getPublicUserByAddress(walletAddress: string): Promise<PublicUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: {
        biome: {
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return this.usersUtils.transformToPublicDto(user);
  }

  async getRecentActivity(hours: number = 24): Promise<PublicUserDto[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        isConnected: true,
        lastActivityAt: { gte: since },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 50,
      include: {
        biome: {
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
        },
      },
    });

    return users.map(user => this.usersUtils.transformToPublicDto(user));
  }

  async compareUsers(address1: string, address2: string) {
    const user1 = await this.getPublicUserByAddress(address1);
    const user2 = await this.getPublicUserByAddress(address2);

    const activityDifference = user1.activityScore - user2.activityScore;
    const treesDifference = (user1.biome?.totalTrees || 0) - (user2.biome?.totalTrees || 0);
    const healthDifference = (user1.biome?.healthScore || 0) - (user2.biome?.healthScore || 0);

    // Déterminer le gagnant basé sur un score combiné
    const user1Score = user1.activityScore + (user1.biome?.totalTrees || 0) * 10 + (user1.biome?.healthScore || 0);
    const user2Score = user2.activityScore + (user2.biome?.totalTrees || 0) * 10 + (user2.biome?.healthScore || 0);

    let winner: 'user1' | 'user2' | 'tie' = 'tie';
    if (user1Score > user2Score) winner = 'user1';
    else if (user2Score > user1Score) winner = 'user2';

    return {
      user1,
      user2,
      comparison: {
        activityDifference,
        treesDifference,
        healthDifference: parseFloat(healthDifference.toFixed(2)),
        winner,
      },
    };
  }
}