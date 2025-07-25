import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlantSpecies } from '@prisma/client';

@Injectable()
export class BiomesService {
    constructor(private prisma: PrismaService) { }

    // Obtenir le biome d'un utilisateur avec ses arbres
    async getUserBiome(userId: string) {
        const biome = await this.prisma.biome.findUnique({
            where: { userId },
            include: {
                plants: {
                    where: { isAlive: true },
                    orderBy: [
                        { growthLevel: 'desc' },
                        { health: 'desc' },
                    ],
                },
                user: {
                    select: {
                        username: true,
                        activityScore: true,
                        lastActivityAt: true,
                    },
                },
            },
        });

        if (!biome) {
            throw new NotFoundException('Biome not found');
        }

        return biome;
    }

    // Obtenir le biome public d'un utilisateur par adresse wallet
    async getPublicBiome(walletAddress: string) {
        const user = await this.prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
            include: {
                biome: {
                    include: {
                        plants: {
                            where: { isAlive: true },
                            orderBy: { growthLevel: 'desc' },
                        },
                    },
                },
            },
        });

        if (!user || !user.biome) {
            throw new NotFoundException('Biome not found');
        }

        return {
            owner: {
                username: user.username,
                walletAddress: user.walletAddress,
                activityScore: user.activityScore,
                lastActivityAt: user.lastActivityAt,
            },
            biome: user.biome,
        };
    }

    // Mettre à jour l'activité utilisateur et déclencher la croissance
    async updateUserActivity(userId: string, activityPoints: number = 10) {
        const result = await this.prisma.$transaction(async (prisma) => {
            // Mettre à jour le score d'activité
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    activityScore: { increment: activityPoints },
                    lastActivityAt: new Date(),
                },
            });

            // Déclencher la croissance des arbres
            await this.processTreeGrowth(userId, activityPoints, prisma);

            // Mettre à jour la santé du biome
            await this.updateBiomeHealth(userId, prisma);

            return user;
        });

        return result;
    }

    // Faire pousser les arbres basé sur l'activité
    private async processTreeGrowth(userId: string, activityPoints: number, prisma: any) {
        const biome = await prisma.biome.findUnique({
            where: { userId },
            include: { trees: { where: { isAlive: true } } },
        });

        if (!biome) return;

        // Calculer la probabilité de croissance basée sur l'activité
        const growthProbability = Math.min(activityPoints / 100, 0.8); // Max 80%

        for (const tree of biome.trees) {
            if (Math.random() < growthProbability) {
                await this.growTree(tree.id, prisma);
            }
        }

        // Chance de planter un nouvel arbre si très actif
        if (activityPoints > 50 && biome.trees.length < 25 && Math.random() < 0.3) {
            await this.plantNewTree(biome.id, prisma);
        }
    }

    // Faire grandir un arbre spécifique
    private async growTree(treeId: string, prisma: any) {
        const tree = await prisma.tree.findUnique({
            where: { id: treeId },
        });

        if (!tree || !tree.isAlive || tree.growthLevel >= 10) return;

        let newGrowthLevel = tree.growthLevel + 1;
        let newSpecies = tree.species;

        // Évolution des espèces selon le niveau
        if (newGrowthLevel >= 9) newSpecies = PlantSpecies.GIANT;
        else if (newGrowthLevel >= 7) newSpecies = PlantSpecies.TREE;
        else if (newGrowthLevel >= 5) newSpecies = PlantSpecies.SAPLING;
        else if (newGrowthLevel >= 3) newSpecies = PlantSpecies.SPROUT;

        await prisma.tree.update({
            where: { id: treeId },
            data: {
                growthLevel: newGrowthLevel,
                species: newSpecies,
                health: Math.min(tree.health + 5, 100), // Récupération de santé
                lastGrowthAt: new Date(),
                isDegraded: false,
            },
        });
    }

    // Planter un nouvel arbre
    private async plantNewTree(biomeId: string, prisma: any) {
        const existingTrees = await prisma.tree.findMany({
            where: { biomeId },
            select: { positionX: true, positionY: true },
        });

        const usedPositions = new Set(
            existingTrees.map(t => `${t.positionX},${t.positionY}`)
        );

        // Trouver une position libre
        let positionX, positionY, positionKey;
        let attempts = 0;

        do {
            positionX = Math.floor(Math.random() * 10);
            positionY = Math.floor(Math.random() * 10);
            positionKey = `${positionX},${positionY}`;
            attempts++;
        } while (usedPositions.has(positionKey) && attempts < 50);

        if (attempts >= 50) return; // Pas de place libre

        await prisma.tree.create({
            data: {
                biomeId,
                name: `arbre-${Date.now()}`,
                species: PlantSpecies.SEEDLING,
                positionX,
                positionY,
                growthLevel: 1,
                health: 100,
            },
        });

        // Mettre à jour le compteur d'arbres du biome
        await prisma.biome.update({
            where: { id: biomeId },
            data: { totalTrees: { increment: 1 } },
        });
    }

    // Mettre à jour la santé du biome
    private async updateBiomeHealth(userId: string, prisma: any) {
        const biome = await prisma.biome.findUnique({
            where: { userId },
            include: {
                trees: { where: { isAlive: true } },
                user: { select: { lastActivityAt: true } }
            },
        });

        if (!biome) return;

        // Calculer la santé moyenne des arbres
        const totalHealth = biome.trees.reduce((sum, tree) => sum + parseFloat(tree.health.toString()), 0);
        const avgHealth = biome.trees.length > 0 ? totalHealth / biome.trees.length : 0;

        // Facteur d'activité récente
        const daysSinceActivity = Math.floor(
            (Date.now() - biome.user.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const activityFactor = Math.max(0.5, 1 - (daysSinceActivity * 0.1)); // Dégradation progressive

        const newHealthScore = Math.max(0, avgHealth * activityFactor);

        await prisma.biome.update({
            where: { id: biome.id },
            data: {
                healthScore: newHealthScore,
                lastUpdateAt: new Date(),
            },
        });
    }

    // Processus de dégradation (à appeler via un cron job)
    async processDegradation() {
        const inactiveUsers = await this.prisma.user.findMany({
            where: {
                lastActivityAt: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Plus de 24h d'inactivité
                },
                isConnected: true,
            },
            include: {
                biome: {
                    include: { plants: { where: { isAlive: true } } },
                },
            },
        });

        for (const user of inactiveUsers) {
            if (!user.biome) continue;

            // Dégrader la santé des arbres
            for (const tree of user.biome.plants) {
                const daysSinceActivity = Math.floor(
                    (Date.now() - user.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
                );

                const healthLoss = Math.min(daysSinceActivity * 2, 20); // Max 20 points par jour
                const newHealth = Math.max(0, parseFloat(tree.health.toString()) - healthLoss);

                await this.prisma.plant.update({
                    where: { id: tree.id },
                    data: {
                        health: newHealth,
                        isDegraded: newHealth < 50,
                        isAlive: newHealth > 0,
                        lastHealthCheck: new Date(),
                    },
                });

                // Si l'arbre meurt, décrémenter le compteur
                if (newHealth === 0 && tree.isAlive) {
                    await this.prisma.biome.update({
                        where: { id: user.biome.id },
                        data: { totalTrees: { decrement: 1 } },
                    });
                }
            }

            // Mettre à jour la santé du biome
            await this.updateBiomeHealth(user.id, this.prisma);
        }

        return `Processed degradation for ${inactiveUsers.length} inactive users`;
    }
}