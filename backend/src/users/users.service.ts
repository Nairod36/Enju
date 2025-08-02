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
    const message = `Please sign this message to authenticate with Enju SwapForest: ${nonce}`;

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

    const expectedMessage = `Please sign this message to authenticate with Enju SwapForest: ${user.nonce}`;
    if (message !== expectedMessage) {
      // Si l'utilisateur est déjà connecté et le message semble valide (commence par le bon préfixe),
      // on peut accepter un ancien nonce pour éviter les problèmes de concurrence
      const messagePrefix = 'Please sign this message to authenticate with Enju SwapForest: nonce-';
      if (!user.isConnected || !message.startsWith(messagePrefix)) {
        throw new InvalidSignatureException('Invalid message');
      }
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
    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const updatedUser = await prisma.user.update({
          where: { walletAddress: walletAddress.toLowerCase() },
          data: {
            isConnected: true,
            lastLoginAt: new Date(),
            lastActivityAt: new Date(),
            chainId: connectWalletDto.chainId || 1,
            // S'assurer que les champs Decimal ont des valeurs
            tokenBalance: isNewUser ? 0 : undefined,
            ...(isNewUser && {
              level: 1,
              experience: 0,
              activityScore: 10, // Points de démarrage
            }),
          },
        });

        // Créer l'île initiale si nouveau utilisateur
        if (isNewUser) {
          const defaultSeed = Math.floor(Math.random() * 1000000);
          
          await prisma.island.create({
            data: {
              userId: updatedUser.id,
              name: 'Ma Première Île',
              seed: BigInt(defaultSeed),
              description: 'Le début de mon aventure insulaire',
              isActive: true,
              islandData: {
                landTiles: [],
                waterTiles: [],
                rocks: [],
                houses: [],
                totalTiles: 50,
                waterColor: '#4682B4'
              },
              treeCount: 0,
              totalTrees: 0,
              healthScore: 100,
              version: '1.0.0'
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
    } catch (error) {
      console.error('❌ Erreur dans transaction:', error);
      throw error;
    }
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
      orderBy = { islands: { _count: true } };
    } else if (sortBy === 'health') {
      orderBy = { activityScore: 'desc' }; // Fallback sur activityScore
    }

    const users = await this.prisma.user.findMany({
      where: { isConnected: true },
      orderBy,
      take: limit,
      include: {
        islands: {
          where: { isActive: true },
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
          take: 1
        },
      },
    });

    return users.map(user => this.usersUtils.transformToPublicDto(user));
  }

  async getLeaderboard(category: string = 'activity', limit: number = 10): Promise<LeaderboardDto[]> {
    const users = await this.prisma.user.findMany({
      where: { isConnected: true },
      take: limit,
      include: {
        islands: {
          where: { isActive: true },
          select: {
            totalTrees: true,
            healthScore: true,
          },
          take: 1
        },
      },
    });

    // Trier côté application selon la catégorie
    const sortedUsers = users.sort((a, b) => {
      if (category === 'activity') {
        return b.activityScore - a.activityScore;
      } else if (category === 'trees') {
        const aTreeCount = a.islands[0]?.totalTrees || 0;
        const bTreeCount = b.islands[0]?.totalTrees || 0;
        return bTreeCount - aTreeCount;
      } else if (category === 'health') {
        const aHealth = parseFloat(a.islands[0]?.healthScore?.toString() || '0');
        const bHealth = parseFloat(b.islands[0]?.healthScore?.toString() || '0');
        return bHealth - aHealth;
      }
      return 0;
    });

    return sortedUsers.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      walletAddress: user.walletAddress,
      score: category === 'activity' ? user.activityScore :
        category === 'trees' ? user.islands[0]?.totalTrees || 0 :
          parseFloat(user.islands[0]?.healthScore?.toString() || '0'),
      category,
      biomeStats: user.islands[0] ? {
        totalTrees: user.islands[0].totalTrees,
        healthScore: parseFloat(user.islands[0].healthScore.toString()),
      } : undefined,
    }));
  }

  async getPublicUserByAddress(walletAddress: string): Promise<PublicUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: {
        islands: {
          where: { isActive: true },
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
          take: 1
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
        islands: {
          where: { isActive: true },
          select: {
            name: true,
            description: true,
            totalTrees: true,
            healthScore: true,
            lastUpdateAt: true,
          },
          take: 1
        },
      },
    });

    return users.map(user => this.usersUtils.transformToPublicDto(user));
  }

  async compareUsers(address1: string, address2: string) {
    const user1 = await this.getPublicUserByAddress(address1);
    const user2 = await this.getPublicUserByAddress(address2);

    const activityDifference = user1.activityScore - user2.activityScore;
    const treesDifference = (user1.island?.totalTrees || 0) - (user2.island?.totalTrees || 0);
    const healthDifference = (user1.island?.healthScore || 0) - (user2.island?.healthScore || 0);

    // Déterminer le gagnant basé sur un score combiné
    const user1Score = user1.activityScore + (user1.island?.totalTrees || 0) * 10 + (user1.island?.healthScore || 0);
    const user2Score = user2.activityScore + (user2.island?.totalTrees || 0) * 10 + (user2.island?.healthScore || 0);

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