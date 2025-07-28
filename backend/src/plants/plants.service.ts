import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlantSpecies } from '@prisma/client';
import { CreatePlantDto, UpdatePlantDto, MoveePlantDto } from './dto';
import {
    BiomeNotFoundException,
    BiomeNotCreatedYetException,
    PlantNotFoundException,
    PlantNotOwnedException,
    PositionOccupiedException,
    InvalidPositionException,
    PlantDeadException,
    BiomeFullException,
    UserNotRegisteredYetException
} from '../common/exceptions';

@Injectable()
export class PlantsService {
    constructor(private prisma: PrismaService) { }

    async getUserPlants(userId: string) {
        const biome = await this.prisma.biome.findUnique({
            where: { userId },
            include: {
                plants: {
                    where: { isAlive: true },
                    orderBy: [
                        { positionY: 'asc' },
                        { positionX: 'asc' }
                    ],
                },
            },
        });

        if (!biome) {
            throw new BiomeNotFoundException();
        }

        return biome.plants;
    }

    async getPublicPlants(walletAddress: string) {
        const user = await this.prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
            include: {
                biome: {
                    include: {
                        plants: {
                            where: { isAlive: true },
                            orderBy: [
                                { positionY: 'asc' },
                                { positionX: 'asc' }
                            ],
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UserNotRegisteredYetException(walletAddress);
        }

        if (!user.biome) {
            throw new BiomeNotCreatedYetException(walletAddress);
        }

        return user.biome.plants;
    }

    async createPlant(userId: string, createPlantDto: CreatePlantDto) {
        const biome = await this.prisma.biome.findUnique({
            where: { userId },
            include: { plants: true },
        });

        if (!biome) {
            throw new BiomeNotFoundException();
        }

        // Vérifier que la position est libre
        const existingPlant = await this.prisma.plant.findFirst({
            where: {
                biomeId: biome.id,
                positionX: createPlantDto.positionX,
                positionY: createPlantDto.positionY,
                isAlive: true,
            },
        });

        if (existingPlant) {
            throw new PositionOccupiedException(createPlantDto.positionX, createPlantDto.positionY);
        }

        // Vérifier les limites de la grille (0-9)
        if (createPlantDto.positionX < 0 || createPlantDto.positionX > 9 ||
            createPlantDto.positionY < 0 || createPlantDto.positionY > 9) {
            throw new InvalidPositionException();
        }

        // Vérifier la limite de plantes (25 maximum)
        if (biome.plants.length >= 25) {
            throw new BiomeFullException();
        }

        const plant = await this.prisma.plant.create({
            data: {
                biomeId: biome.id,
                name: createPlantDto.name,
                positionX: createPlantDto.positionX,
                positionY: createPlantDto.positionY,
                species: PlantSpecies.SEEDLING,
                growthLevel: 1,
                health: 100,
            },
        });

        // Mettre à jour le compteur d'arbres du biome
        await this.prisma.biome.update({
            where: { id: biome.id },
            data: { totalTrees: { increment: 1 } },
        });

        return plant;
    }

    async movePlant(userId: string, plantId: string, movePlantDto: MoveePlantDto) {
        const plant = await this.prisma.plant.findUnique({
            where: { id: plantId },
            include: { biome: true },
        });

        if (!plant) {
            throw new PlantNotFoundException();
        }

        if (plant.biome.userId !== userId) {
            throw new PlantNotOwnedException();
        }

        // Vérifier que la nouvelle position est libre
        const existingPlant = await this.prisma.plant.findFirst({
            where: {
                biomeId: plant.biomeId,
                positionX: movePlantDto.positionX,
                positionY: movePlantDto.positionY,
                isAlive: true,
                id: { not: plantId }, // Exclure la plante qu'on déplace
            },
        });

        if (existingPlant) {
            throw new PositionOccupiedException(movePlantDto.positionX, movePlantDto.positionY);
        }

        // Vérifier les limites de la grille
        if (movePlantDto.positionX < 0 || movePlantDto.positionX > 9 ||
            movePlantDto.positionY < 0 || movePlantDto.positionY > 9) {
            throw new InvalidPositionException();
        }

        return this.prisma.plant.update({
            where: { id: plantId },
            data: {
                positionX: movePlantDto.positionX,
                positionY: movePlantDto.positionY,
            },
        });
    }

    async updatePlant(userId: string, plantId: string, updatePlantDto: UpdatePlantDto) {
        const plant = await this.prisma.plant.findUnique({
            where: { id: plantId },
            include: { biome: true },
        });

        if (!plant) {
            throw new PlantNotFoundException();
        }

        if (plant.biome.userId !== userId) {
            throw new PlantNotOwnedException();
        }

        return this.prisma.plant.update({
            where: { id: plantId },
            data: {
                name: updatePlantDto.name,
            },
        });
    }

    async removePlant(userId: string, plantId: string) {
        const plant = await this.prisma.plant.findUnique({
            where: { id: plantId },
            include: { biome: true },
        });

        if (!plant) {
            throw new PlantNotFoundException();
        }

        if (plant.biome.userId !== userId) {
            throw new PlantNotOwnedException();
        }

        await this.prisma.plant.update({
            where: { id: plantId },
            data: { isAlive: false },
        });

        // Décrémenter le compteur d'arbres du biome
        await this.prisma.biome.update({
            where: { id: plant.biomeId },
            data: { totalTrees: { decrement: 1 } },
        });

        return { message: 'Plant removed successfully' };
    }

    async getBiomeGrid(walletAddress: string) {
        const user = await this.prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
            include: {
                biome: {
                    include: {
                        plants: {
                            where: { isAlive: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UserNotRegisteredYetException(walletAddress);
        }

        if (!user.biome) {
            throw new BiomeNotCreatedYetException(walletAddress);
        }

        // Créer une grille 10x10
        const grid = Array(10).fill(null).map(() => Array(10).fill(null));

        // Placer les plantes dans la grille
        for (const plant of user.biome.plants) {
            grid[plant.positionY][plant.positionX] = {
                id: plant.id,
                name: plant.name,
                species: plant.species,
                growthLevel: plant.growthLevel,
                health: plant.health,
            };
        }

        return {
            owner: {
                username: user.username,
                walletAddress: user.walletAddress,
            },
            biome: {
                name: user.biome.name,
                totalTrees: user.biome.totalTrees,
                healthScore: user.biome.healthScore,
            },
            grid,
        };
    }

    async waterPlant(userId: string, plantId: string) {
        const plant = await this.prisma.plant.findUnique({
            where: { id: plantId },
            include: { biome: true },
        });

        if (!plant) {
            throw new PlantNotFoundException();
        }

        if (plant.biome.userId !== userId) {
            throw new PlantNotOwnedException();
        }

        if (!plant.isAlive) {
            throw new PlantDeadException('Cannot water a dead plant');
        }

        const newHealth = Math.min(100, parseFloat(plant.health.toString()) + 10);

        return this.prisma.plant.update({
            where: { id: plantId },
            data: {
                health: newHealth,
                isDegraded: newHealth >= 50 ? false : plant.isDegraded,
                lastHealthCheck: new Date(),
            },
        });
    }
}