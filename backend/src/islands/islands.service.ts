import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIslandDto, UpdateIslandDto, IslandResponseDto } from './dto';

@Injectable()
export class IslandsService {
  constructor(private prisma: PrismaService) {}

  async createIsland(userId: string, createIslandDto: CreateIslandDto): Promise<IslandResponseDto> {
    const { userTrees = [], chests = [], usedTiles = [], ...islandData } = createIslandDto;

    // Si l'île est définie comme active, désactiver les autres îles de l'utilisateur
    if (createIslandDto.isActive !== false) {
      await this.prisma.island.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      // Créer l'île
      const island = await prisma.island.create({
        data: {
          userId,
          name: islandData.name,
          seed: BigInt(islandData.seed),
          islandData: islandData.islandData,
          treeCount: islandData.treeCount || 0,
          description: islandData.description,
          totalTrees: islandData.totalTrees || 0,
          healthScore: islandData.healthScore || 100,
          isActive: createIslandDto.isActive !== false,
          version: '1.0.0'
        }
      });

      // Créer les arbres
      if (userTrees.length > 0) {
        await prisma.islandTree.createMany({
          data: userTrees.map(tree => ({
            islandId: island.id,
            treeData: tree
          }))
        });
      }

      // Créer les coffres
      if (chests.length > 0) {
        await prisma.islandChest.createMany({
          data: chests.map(chest => ({
            islandId: island.id,
            chestData: chest
          }))
        });
      }

      // Créer les tuiles utilisées
      if (usedTiles.length > 0) {
        await prisma.islandUsedTile.createMany({
          data: usedTiles.map(tileKey => ({
            islandId: island.id,
            tileKey
          }))
        });
      }

      return island;
    });

    return this.transformToResponseDto(result);
  }

  async getUserIslands(userId: string): Promise<IslandResponseDto[]> {
    const islands = await this.prisma.island.findMany({
      where: { userId },
      orderBy: [
        { isActive: 'desc' },
        { lastModified: 'desc' }
      ],
      include: {
        userTrees: true,
        chests: true,
        usedTiles: true
      }
    });

    return islands.map(island => this.transformToResponseDto(island));
  }

  async getActiveIsland(userId: string): Promise<IslandResponseDto | null> {
    const island = await this.prisma.island.findFirst({
      where: { userId, isActive: true },
      include: {
        userTrees: true,
        chests: true,
        usedTiles: true
      }
    });

    return island ? this.transformToResponseDto(island) : null;
  }

  async ensureUserHasIsland(userId: string): Promise<IslandResponseDto> {
    // Vérifier si l'utilisateur a déjà une île active
    let activeIsland = await this.getActiveIsland(userId);
    
    if (activeIsland) {
      return activeIsland;
    }

    // Vérifier si l'utilisateur a des îles mais aucune active
    const existingIslands = await this.prisma.island.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (existingIslands.length > 0) {
      // Activer la première île trouvée
      await this.prisma.island.update({
        where: { id: existingIslands[0].id },
        data: { isActive: true }
      });
      
      return this.getIslandById(userId, existingIslands[0].id);
    }

    // Créer une nouvelle île par défaut
    const defaultSeed = Math.floor(Math.random() * 1000000);
    
    const newIsland = await this.createIsland(userId, {
      name: 'Mon Île',
      seed: defaultSeed,
      description: 'Mon île personnelle',
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
      isActive: true,
      userTrees: [],
      chests: [],
      usedTiles: []
    });

    return newIsland;
  }

  async getIslandById(userId: string, islandId: string): Promise<IslandResponseDto> {
    const island = await this.prisma.island.findFirst({
      where: { id: islandId, userId },
      include: {
        userTrees: true,
        chests: true,
        usedTiles: true
      }
    });

    if (!island) {
      throw new NotFoundException('Island not found');
    }

    return this.transformToResponseDto(island);
  }

  async updateIsland(userId: string, islandId: string, updateIslandDto: UpdateIslandDto): Promise<IslandResponseDto> {
    const { userTrees, chests, usedTiles, ...updateData } = updateIslandDto;

    const existingIsland = await this.prisma.island.findFirst({
      where: { id: islandId, userId }
    });

    if (!existingIsland) {
      throw new NotFoundException('Island not found');
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      // Mettre à jour l'île
      const updatedIsland = await prisma.island.update({
        where: { id: islandId },
        data: {
          ...updateData,
          lastModified: new Date()
        }
      });

      // Mettre à jour les arbres si fournis
      if (userTrees !== undefined) {
        // Supprimer les anciens arbres
        await prisma.islandTree.deleteMany({
          where: { islandId }
        });
        
        // Créer les nouveaux arbres
        if (userTrees.length > 0) {
          await prisma.islandTree.createMany({
            data: userTrees.map(tree => ({
              islandId,
              treeData: tree
            }))
          });
        }
      }

      // Mettre à jour les coffres si fournis
      if (chests !== undefined) {
        await prisma.islandChest.deleteMany({
          where: { islandId }
        });
        
        if (chests.length > 0) {
          await prisma.islandChest.createMany({
            data: chests.map(chest => ({
              islandId,
              chestData: chest
            }))
          });
        }
      }

      // Mettre à jour les tuiles utilisées si fournies
      if (usedTiles !== undefined) {
        await prisma.islandUsedTile.deleteMany({
          where: { islandId }
        });
        
        if (usedTiles.length > 0) {
          await prisma.islandUsedTile.createMany({
            data: usedTiles.map(tileKey => ({
              islandId,
              tileKey
            }))
          });
        }
      }

      return updatedIsland;
    });

    return this.getIslandById(userId, islandId);
  }

  async setActiveIsland(userId: string, islandId: string): Promise<IslandResponseDto> {
    const island = await this.prisma.island.findFirst({
      where: { id: islandId, userId }
    });

    if (!island) {
      throw new NotFoundException('Island not found');
    }

    await this.prisma.$transaction(async (prisma) => {
      // Désactiver toutes les îles de l'utilisateur
      await prisma.island.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });

      // Activer l'île spécifiée
      await prisma.island.update({
        where: { id: islandId },
        data: { isActive: true, lastModified: new Date() }
      });
    });

    return this.getIslandById(userId, islandId);
  }

  async deleteIsland(userId: string, islandId: string): Promise<void> {
    const island = await this.prisma.island.findFirst({
      where: { id: islandId, userId }
    });

    if (!island) {
      throw new NotFoundException('Island not found');
    }

    if (island.isActive) {
      throw new BadRequestException('Cannot delete active island. Set another island as active first.');
    }

    await this.prisma.island.delete({
      where: { id: islandId }
    });
  }

  async getIslandsBySeed(seed: number): Promise<IslandResponseDto[]> {
    const islands = await this.prisma.island.findMany({
      where: { seed: BigInt(seed) },
      include: {
        user: {
          select: {
            username: true,
            walletAddress: true
          }
        },
        userTrees: true,
        chests: true,
        usedTiles: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return islands.map(island => ({
      ...this.transformToResponseDto(island),
      owner: {
        username: island.user.username,
        walletAddress: island.user.walletAddress
      }
    }));
  }

  async autoSaveIsland(userId: string, islandId: string, updateData: UpdateIslandDto): Promise<IslandResponseDto> {
    // Mettre à jour automatiquement lastModified et lastUpdateAt
    const autoUpdateData = {
      ...updateData,
      lastModified: new Date(),
      lastUpdateAt: new Date()
    };

    return this.updateIsland(userId, islandId, autoUpdateData);
  }

  private transformToResponseDto(island: any): IslandResponseDto {
    return {
      id: island.id,
      name: island.name,
      seed: island.seed.toString(),
      isActive: island.isActive,
      islandData: island.islandData,
      treeCount: island.treeCount,
      description: island.description,
      totalTrees: island.totalTrees,
      healthScore: island.healthScore ? parseFloat(island.healthScore.toString()) : 100,
      createdAt: island.createdAt,
      lastModified: island.lastModified,
      version: island.version,
      userTrees: island.userTrees?.map(t => t.treeData) || [],
      chests: island.chests?.map(c => c.chestData) || [],
      usedTiles: island.usedTiles?.map(u => u.tileKey) || []
    };
  }
}