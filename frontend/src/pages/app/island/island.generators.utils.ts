import { HexPosition, TileData, RockData, HouseData, IslandGenerationResult } from './island.types';
import { HEX_RADIUS, HEX_HEIGHT, HEX_WIDTH, WATER_DEPTH } from './island.const';
import {
    generateIslandShape,
    enlargeIslandShape,
    generateRiverPattern,
    generateWaterColor,
    generateLandColors,
    generateNoise
} from './island.generators';

// ===== GÉNÉRATEUR D'ÎLE =====

// Validation renforcée des données
const validateNumber = (value: any, defaultValue: number = 0): number => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        console.warn(`⚠️ Valeur invalide détectée: ${value}, utilisation de ${defaultValue}`);
        return defaultValue;
    }
    return value;
};

const validatePosition = (position: [number, number, number]): [number, number, number] => {
    return [
        validateNumber(position[0]),
        validateNumber(position[1]),
        validateNumber(position[2])
    ];
};

const validateKey = (row: number, col: number): string => {
    const validRow = validateNumber(row);
    const validCol = validateNumber(col);
    return `${validRow},${validCol}`;
};

// Fonction de lissage automatique des contours d'îles
const smoothIslandContours = (islandShape: any[], seed: number): any[] => {
    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    // Créer un set de toutes les tuiles existantes
    const tileSet = new Set<string>();
    islandShape.forEach(({ row, cols }) => {
        cols.forEach((col: number) => {
            tileSet.add(`${row},${col}`);
        });
    });

    // Fonction pour compter les voisins
    const countNeighbors = (row: number, col: number): number => {
        const neighbors = [
            [row - 1, col], [row + 1, col],
            [row, col - 1], [row, col + 1],
            [row - 1, col + (row % 2 === 0 ? -1 : 1)],
            [row + 1, col + (row % 2 === 0 ? -1 : 1)]
        ];
        return neighbors.filter(([r, c]) => tileSet.has(`${r},${c}`)).length;
    };

    // Passe de lissage : retirer les tuiles isolées
    const tilesToRemove = new Set<string>();
    tileSet.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);
        const neighborCount = countNeighbors(row, col);

        // Retirer les tuiles avec moins de 2 voisins (isolées)
        if (neighborCount < 2) {
            tilesToRemove.add(tileKey);
        }
    });

    tilesToRemove.forEach(tile => tileSet.delete(tile));

    // Passe de remplissage : ajouter des tuiles pour lisser les contours
    const tilesToAdd = new Set<string>();
    tileSet.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        // Vérifier les voisins vides
        const neighbors = [
            [row - 1, col], [row + 1, col],
            [row, col - 1], [row, col + 1],
            [row - 1, col + (row % 2 === 0 ? -1 : 1)],
            [row + 1, col + (row % 2 === 0 ? -1 : 1)]
        ];

        neighbors.forEach(([r, c]) => {
            const neighborKey = `${r},${c}`;
            if (!tileSet.has(neighborKey)) {
                const neighborOfNeighbor = countNeighbors(r, c);
                // Ajouter si le voisin vide a suffisamment de voisins existants
                if (neighborOfNeighbor >= 3 && rand(seed * 1000 + r * 100 + c) > 0.3) {
                    tilesToAdd.add(neighborKey);
                }
            }
        });
    });

    tilesToAdd.forEach(tile => tileSet.add(tile));

    // Reconvertir en format IslandShape
    const tilesByRow = new Map<number, number[]>();
    tileSet.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (!isNaN(row) && !isNaN(col) && isFinite(row) && isFinite(col)) {
            if (!tilesByRow.has(row)) {
                tilesByRow.set(row, []);
            }
            tilesByRow.get(row)!.push(col);
        }
    });

    const result: any[] = [];
    Array.from(tilesByRow.keys()).sort((a, b) => a - b).forEach(row => {
        const cols = tilesByRow.get(row)!.sort((a, b) => a - b);
        result.push({ row, cols });
    });

    return result;
};

export const getHexPosition = (
    row: number,
    col: number,
    centerRow: number = 0,
    centerCol: number = 0
): HexPosition => {
    const offset = row % 2 === 0 ? 0 : HEX_WIDTH * 0.5;

    const dx = (col - centerCol) * HEX_WIDTH * 0.75 + offset;
    const dz = (row - centerRow) * HEX_HEIGHT * 0.5;

    return {
        x: dx,
        z: dz,
        row,
        col,
    };
};


// Générateur de relief progressif GARANTI
const generateProgressiveTerrain = (seed: number) => {
    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const terrainType = Math.floor(rand(seed * 1.1) * 4); // 4 types seulement
    const features = [];

    switch (terrainType) {
        case 0: // Relief concentrique (montagne au centre) - RÉDUIT
            // Montagne centrale seulement si assez loin du bord
            features.push({
                type: 'concentric_mountain',
                x: 0,
                z: 0,
                height: 1.8 + rand(seed * 2.2) * 0.8, // 1.8-2.6 RÉDUIT
                radius: 8 + rand(seed * 3.3) * 2,     // 8-10 RÉDUIT
                slope: 1.5
            });

            // Seulement 1-2 anneaux au lieu de 3
            const numRings = 1 + Math.floor(rand(seed * 50) * 2); // 1-2 anneaux
            for (let ring = 1; ring <= numRings; ring++) {
                const ringRadius = 5 + ring * 2.5; // 7.5, 10
                const hillsInRing = 4 + ring; // 5, 6 collines (RÉDUIT)

                for (let h = 0; h < hillsInRing; h++) {
                    const angle = (h / hillsInRing) * Math.PI * 2;
                    const variation = (rand(seed * (100 + ring * 10 + h)) - 0.5) * 1.5;

                    // Seulement si assez loin du centre et pas trop près du bord
                    const distance = ringRadius + variation;
                    if (distance > 4 && distance < 10) {
                        features.push({
                            type: 'concentric_hill',
                            x: Math.cos(angle) * distance,
                            z: Math.sin(angle) * distance,
                            height: (1.2 - ring * 0.2) + rand(seed * (200 + ring * 10 + h)) * 0.3, // RÉDUIT
                            radius: 2.5 + rand(seed * (300 + ring * 10 + h)) * 1.5, // RÉDUIT
                            slope: 1.8
                        });
                    }
                }
            }
            break;

        case 1: // Relief en bandes (collines parallèles) - RÉDUIT
            const bandAngle = rand(seed * 10) * Math.PI * 2;
            const numBands = 2 + Math.floor(rand(seed * 20) * 2); // 2-3 bandes RÉDUIT

            for (let band = 0; band < numBands; band++) {
                const bandOffset = (band - numBands / 2) * 3; // Espacement réduit
                const bandHeight = 1.2 + rand(seed * (400 + band)) * 0.8; // 1.2-2.0 RÉDUIT

                // Moins de points par bande
                const pointsInBand = 3 + Math.floor(rand(seed * (500 + band)) * 3); // 3-5 points RÉDUIT
                for (let p = 0; p < pointsInBand; p++) {
                    const t = (p / (pointsInBand - 1) - 0.5) * 12; // Longueur réduite

                    const x = Math.cos(bandAngle) * bandOffset + Math.cos(bandAngle + Math.PI / 2) * t;
                    const z = Math.sin(bandAngle) * bandOffset + Math.sin(bandAngle + Math.PI / 2) * t;
                    const distance = Math.sqrt(x * x + z * z);

                    // Éviter les bords de l'île
                    if (distance < 11) {
                        features.push({
                            type: 'band_ridge',
                            x,
                            z,
                            height: bandHeight + rand(seed * (600 + band * 10 + p)) * 0.2, // RÉDUIT
                            radius: 3 + rand(seed * (700 + band * 10 + p)) * 1.5, // RÉDUIT
                            slope: 1.6
                        });
                    }
                }
            }
            break;

        case 2: // Relief aléatoire (terrain accidenté) - RÉDUIT
            const numRandomFeatures = 4 + Math.floor(rand(seed * 30) * 3); // 4-6 features RÉDUIT

            for (let i = 0; i < numRandomFeatures; i++) {
                const angle = rand(seed * (800 + i)) * Math.PI * 2;
                const distance = rand(seed * (900 + i)) * 8; // 0-8 unités (éviter les bords)
                const featureType = Math.floor(rand(seed * (1000 + i)) * 3);

                // Éviter les bords de l'île
                if (distance < 10) {
                    let height, radius, slope;
                    switch (featureType) {
                        case 0: // Pic rocheux
                            height = 1.5 + rand(seed * (1100 + i)) * 1.0; // 1.5-2.5 RÉDUIT
                            radius = 1.5 + rand(seed * (1200 + i)) * 1.5; // 1.5-3 RÉDUIT
                            slope = 1.2;
                            break;
                        case 1: // Colline douce
                            height = 1.0 + rand(seed * (1300 + i)) * 0.6; // 1.0-1.6 RÉDUIT
                            radius = 3 + rand(seed * (1400 + i)) * 2; // 3-5 RÉDUIT
                            slope = 2.2;
                            break;
                        case 2: // Plateau irrégulier
                            height = 1.2 + rand(seed * (1500 + i)) * 0.6; // 1.2-1.8 RÉDUIT
                            radius = 2.5 + rand(seed * (1600 + i)) * 1.5; // 2.5-4 RÉDUIT
                            slope = 1.9;
                            break;
                    }

                    features.push({
                        type: 'random_feature',
                        x: Math.cos(angle) * distance,
                        z: Math.sin(angle) * distance,
                        height,
                        radius,
                        slope,
                        subtype: featureType
                    });
                }
            }
            break;

        case 3: // Relief côtier (plus haut au centre) - RÉDUIT
            // Centre élevé modéré
            features.push({
                type: 'coastal_center',
                x: 0,
                z: 0,
                height: 2.0 + rand(seed * 40) * 0.6, // 2.0-2.6 RÉDUIT
                radius: 6 + rand(seed * 50) * 2, // 6-8 RÉDUIT
                slope: 2.0
            });

            // Moins de terrasses
            for (let layer = 1; layer <= 2; layer++) { // 2 couches au lieu de 4
                const layerRadius = 4 + layer * 3; // 7, 10
                const layerHeight = 1.6 - layer * 0.3; // 1.3, 1.0
                const pointsInLayer = 6 + layer; // 7, 8 points RÉDUIT

                for (let p = 0; p < pointsInLayer; p++) {
                    const angle = (p / pointsInLayer) * Math.PI * 2;
                    const variation = (rand(seed * (1700 + layer * 100 + p)) - 0.5) * 1.0;
                    const distance = layerRadius + variation;

                    // Éviter les bords
                    if (distance < 11) {
                        features.push({
                            type: 'coastal_terrace',
                            x: Math.cos(angle) * distance,
                            z: Math.sin(angle) * distance,
                            height: Math.max(0.5, layerHeight + rand(seed * (1800 + layer * 100 + p)) * 0.2), // RÉDUIT
                            radius: 2.5 + rand(seed * (1900 + layer * 100 + p)) * 1, // RÉDUIT
                            slope: 2.4,
                            layer
                        });
                    }
                }
            }
            break;
    }

    return { features, terrainType };
};

// Fonctions utilitaires pour l'animation organique de l'île

export interface TileAnimationData {
    delay: number;
    waveGroup: number;
    distanceFromCenter: number;
    angle: number;
}

/**
 * Calcule l'animation organique basée sur une propagation en vagues
 * depuis le centre de l'île vers les bords
 */
export const calculateOrganicAnimation = (
    landTiles: Array<{ position: [number, number, number]; key: string }>,
    seed: number
): TileAnimationData[] => {
    if (!landTiles || landTiles.length === 0) {
        return [];
    }

    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    // Trouver le centre géométrique de l'île
    const centerX = landTiles.reduce((sum, tile) => sum + tile.position[0], 0) / landTiles.length;
    const centerZ = landTiles.reduce((sum, tile) => sum + tile.position[2], 0) / landTiles.length;

    // Calculer les données pour chaque tuile
    const tilesWithData = landTiles.map(tile => {
        const dx = tile.position[0] - centerX;
        const dz = tile.position[2] - centerZ;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);

        return {
            ...tile,
            distanceFromCenter,
            angle,
            normalizedAngle: (angle + Math.PI) / (2 * Math.PI) // 0-1
        };
    });

    // Trouver la distance maximale pour normaliser
    const maxDistance = Math.max(...tilesWithData.map(t => t.distanceFromCenter));

    // Types d'animation basés sur la seed
    const animationType = Math.floor((seed * 7.13) % 1 * 4);

    const animationData: TileAnimationData[] = tilesWithData.map((tile, index) => {
        let delay = 0;
        let waveGroup = 0;

        const normalizedDistance = tile.distanceFromCenter / (maxDistance || 1);

        switch (animationType) {
            case 0: // Vagues concentriques du centre vers l'extérieur
                delay = normalizedDistance * 800 + (rand(seed * 1000 + index) * 100);
                waveGroup = Math.floor(normalizedDistance * 5);
                break;

            case 1: // Spirale
                const spiralDelay = (normalizedDistance * 2 + tile.normalizedAngle * 1.5) * 400;
                delay = spiralDelay + (rand(seed * 2000 + index) * 80);
                waveGroup = Math.floor((normalizedDistance + tile.normalizedAngle) * 3);
                break;

            case 2: // Vagues sectorielles (comme des quartiers de tarte)
                const numSectors = 6;
                const sectorIndex = Math.floor(tile.normalizedAngle * numSectors);
                const sectorDelay = sectorIndex * 150;
                delay = sectorDelay + normalizedDistance * 300 + (rand(seed * 3000 + index) * 60);
                waveGroup = sectorIndex;
                break;

            case 3: // Animation en vagues diagonales
                const waveX = Math.sin(tile.angle) * tile.distanceFromCenter;
                const waveZ = Math.cos(tile.angle) * tile.distanceFromCenter;
                const diagonalProgress = (waveX + waveZ) / (maxDistance * 2) + 0.5;
                delay = diagonalProgress * 600 + (rand(seed * 4000 + index) * 90);
                waveGroup = Math.floor(diagonalProgress * 4);
                break;
        }

        // Ajouter de la variation aléatoire pour plus d'organicité
        const randomVariation = (seed + index * 0.1) % 1;
        delay += Math.sin(randomVariation * Math.PI * 2) * 50;

        // S'assurer que le délai est positif
        delay = Math.max(0, delay);

        return {
            delay: Math.round(delay),
            waveGroup,
            distanceFromCenter: tile.distanceFromCenter,
            angle: tile.angle
        };
    });

    return animationData;
};

/**
 * Génère des particules d'énergie qui accompagnent la construction
 */
export const generateConstructionParticles = (
    centerPosition: [number, number, number],
    currentWave: number,
    seed: number
) => {
    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const particles = [];
    const particleCount = 3 + Math.floor((seed * 8.47) % 1 * 5);

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + currentWave * 0.5;
        const radius = 1 + currentWave * 0.3;
        const height = 0.5 + Math.sin(currentWave + i) * 0.3;

        particles.push({
            position: [
                centerPosition[0] + Math.cos(angle) * radius,
                centerPosition[1] + height,
                centerPosition[2] + Math.sin(angle) * radius
            ] as [number, number, number],
            life: 1.0,
            scale: 0.1 + rand(seed * 5000 + i) * 0.2,
            color: `hsl(${120 + Math.sin(currentWave) * 60}, 70%, 60%)`
        });
    }

    return particles;
};

/**
 * Calcule l'effet de secousse/tremblement pendant la construction
 */
export const calculateConstructionShake = (progress: number, intensity: number = 1, seed: number = Date.now()): [number, number, number] => {
    if (progress >= 1) return [0, 0, 0];

    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const shakeIntensity = (1 - progress) * intensity * 0.02;
    const time = Date.now() * 0.001; // Use time for shake variation

    return [
        (rand(seed * 6000 + time) - 0.5) * shakeIntensity,
        (rand(seed * 7000 + time) - 0.5) * shakeIntensity * 0.5, // Moins de shake vertical
        (rand(seed * 8000 + time) - 0.5) * shakeIntensity
    ];
};

/**
 * Génère des sons organiques pour accompagner l'animation
 * (retourne des paramètres pour une éventuelle implémentation audio)
 */
export const getConstructionSoundParams = (waveGroup: number, totalWaves: number) => {
    const baseFreq = 220; // Note A3
    const waveProgress = waveGroup / totalWaves;

    return {
        frequency: baseFreq * (1 + waveProgress * 0.5), // Monte en fréquence
        duration: 200 + waveProgress * 100, // Sons plus longs vers la fin
        volume: 0.1 + waveProgress * 0.05,
        type: waveGroup < totalWaves * 0.3 ? 'bass' :
            waveGroup < totalWaves * 0.7 ? 'mid' : 'high'
    };
};

// Fonction pour calculer la hauteur progressive DOUCE
const calculateProgressiveHeight = (pos: HexPosition, features: any[], seed: number) => {
    let height = 0.3; // Hauteur de base légèrement réduite

    const distFromCenter = Math.sqrt(pos.x ** 2 + pos.z ** 2);
    const radialFade = 1 - Math.min(distFromCenter / 12, 1); // 12 = rayon visuel max
    height *= radialFade;


    features.forEach(feature => {
        const distance = Math.sqrt(
            Math.pow(pos.x - feature.x, 2) + Math.pow(pos.z - feature.z, 2)
        );

        let influence = 0;

        switch (feature.type) {
            case 'concentric_mountain':
            case 'concentric_hill':
            case 'coastal_center':
            case 'coastal_terrace':
                if (distance < feature.radius) {
                    const t = distance / feature.radius;
                    const smoothness = Math.max(1.5, feature.slope || 1.5);
                    influence = feature.height * Math.pow(1 - t, smoothness);
                }
                break;

            case 'band_ridge':
                if (distance < feature.radius) {
                    const t = distance / feature.radius;
                    // Courbe douce pour les bandes
                    influence = feature.height * Math.pow(1 - t, feature.slope || 1.4);
                }
                break;

            case 'random_feature':
                if (distance < feature.radius) {
                    const t = distance / feature.radius;
                    const smoothness = feature.slope || 1.7;
                    influence = feature.height * Math.pow(1 - t, smoothness);
                }
                break;
        }

        height += influence;
    });

    // Ajouter du bruit très doux pour les détails
    const noise = generateNoise(pos.x, pos.z, seed) * 0.08; // Réduit de moitié
    height += noise;

    // Lissage supplémentaire avec fonction sigmoïde
    height = height / (1 + Math.abs(height) * 0.1); // Fonction de lissage

    // Assurer une hauteur minimale
    return Math.max(0.15, height);
};

export const generateIsland = (seed: number, customShape?: any[]): IslandGenerationResult => {
    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const land: TileData[] = [];
    const water: TileData[] = [];
    const rockPositions: RockData[] = [];
    const housePositions: HouseData[] = [];

    // Génération de la forme de l'île (utiliser la forme personnalisée si fournie)
    const islandShape = customShape || generateIslandShape(seed);

    const allRows = islandShape.map(s => s.row);
    const allCols = islandShape.flatMap(s => s.cols);

    const minRow = Math.min(...allRows);
    const maxRow = Math.max(...allRows);
    const minCol = Math.min(...allCols);
    const maxCol = Math.max(...allCols);

    const centerRow = Math.floor((minRow + maxRow) / 2);
    const centerCol = Math.floor((minCol + maxCol) / 2);


    // Génération du relief progressif
    const { features, terrainType } = generateProgressiveTerrain(seed);

    // Génération de rivières VARIÉES selon le terrain
    const riverPath = new Set<string>();

    // Probabilité et type de rivière selon le terrain
    const riverChance = terrainType === 0 ? 0.8 : // Relief concentrique : rivières radiales 
        terrainType === 1 ? 0.6 : // Relief en bandes : rivières perpendiculaires
            terrainType === 2 ? 0.7 : // Relief aléatoire : rivières chaotiques
                0.9; // Relief côtier : rivières vers les bords

    if (rand(seed * 200) < riverChance) {
        // Utiliser le générateur de rivière existant
        const riverFunction = generateRiverPattern(seed, maxRow);
        const hasNaturalRiver = riverFunction(0) !== 999;

        if (hasNaturalRiver) {
            // Rivière naturelle avec sinuosité
            const riverOffset = Math.floor((rand(seed * 201) - 0.5) * 3); // -1.5 à 1.5

            for (let row = 0; row <= maxRow; row++) {
                const baseCol = riverFunction(row);
                if (typeof baseCol === 'number' && !isNaN(baseCol) && isFinite(baseCol)) {
                    const col = baseCol + riverOffset;
                    riverPath.add(`${row},${col}`);

                    // Largeur variable selon le terrain
                    let riverWidth = 0;
                    if (terrainType === 1 && row >= maxRow * 0.4 && row <= maxRow * 0.6) riverWidth = 1; // Montagne
                    if (terrainType === 3 && row >= maxRow * 0.3 && row <= maxRow * 0.7) riverWidth = 2; // Plateau

                    for (let w = 1; w <= riverWidth; w++) {
                        riverPath.add(`${row},${col - w}`);
                        riverPath.add(`${row},${col + w}`);
                    }
                }
            }
        } else {
            // Rivière droite simple pour certains terrains
            const riverCol = Math.floor((rand(seed * 202) - 0.5) * 4); // -2 à 2
            const startRow = Math.floor(maxRow * 0.2);
            const endRow = Math.floor(maxRow * 0.8);

            for (let row = startRow; row <= endRow; row++) {
                riverPath.add(`${row},${riverCol}`);

                // Légère sinuosité
                if (rand(seed * 203 + row) < 0.3) {
                    const offset = Math.floor((rand(seed * 204 + row) - 0.5) * 2);
                    riverPath.add(`${row},${riverCol + offset}`);
                }
            }
        }
    }

    // Plans d'eau additionnels GARANTIS sur l'île
    const additionalWater = new Set<string>();

    // Position des plans d'eau selon le terrain
    const waterOffsetX = (rand(seed * 300) - 0.5) * 6; // Position aléatoire ± 3
    const waterOffsetZ = (rand(seed * 301) - 0.5) * 6;

    switch (terrainType) {
        case 0: // Cratère volcanique au centre du volcan
            islandShape.forEach(shape => {
                shape.cols.forEach(col => {
                    if (typeof shape.row === 'number' && typeof col === 'number' &&
                        !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                        const pos = getHexPosition(shape.row, col);
                        const distFromCrater = Math.sqrt(
                            Math.pow(pos.x - waterOffsetX, 2) + Math.pow(pos.z - waterOffsetZ, 2)
                        );
                        if (distFromCrater < 1.0 + rand(seed * 302) * 0.4) { // 1.0-1.4
                            additionalWater.add(`${shape.row},${col}`);
                        }
                    }
                });
            });
            break;

        case 1: // Lac de montagne garanti
            const lakeCenterX = (rand(seed * 303) - 0.5) * 6; // Position sur l'île
            const lakeCenterZ = (rand(seed * 304) - 0.5) * 6;

            islandShape.forEach(shape => {
                shape.cols.forEach(col => {
                    if (typeof shape.row === 'number' && typeof col === 'number' &&
                        !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                        const pos = getHexPosition(shape.row, col);
                        const distFromLake = Math.sqrt(
                            Math.pow(pos.x - lakeCenterX, 2) + Math.pow(pos.z - lakeCenterZ, 2)
                        );
                        if (distFromLake < 1.8) { // Taille fixe garantie
                            additionalWater.add(`${shape.row},${col}`);
                        }
                    }
                });
            });
            break;

        case 2: // Étangs multiples garantis entre les collines
            const pondPositions = [
                { x: 0, z: 0 }, // Centre
                { x: 2, z: 1 },
                { x: -1, z: 2 }
            ];

            pondPositions.forEach((pondPos, p) => {
                const pondX = pondPos.x + (rand(seed * (305 + p)) - 0.5) * 1;
                const pondZ = pondPos.z + (rand(seed * (306 + p)) - 0.5) * 1;

                islandShape.forEach(shape => {
                    shape.cols.forEach(col => {
                        if (typeof shape.row === 'number' && typeof col === 'number' &&
                            !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                            const pos = getHexPosition(shape.row, col);
                            const distFromPond = Math.sqrt(
                                Math.pow(pos.x - pondX, 2) + Math.pow(pos.z - pondZ, 2)
                            );
                            if (distFromPond < 1.2) {
                                additionalWater.add(`${shape.row},${col}`);
                            }
                        }
                    });
                });
            });
            break;

        case 3: // Sources sur plateau
            const springCenterX = waterOffsetX;
            const springCenterZ = waterOffsetZ;

            islandShape.forEach(shape => {
                shape.cols.forEach(col => {
                    if (typeof shape.row === 'number' && typeof col === 'number' &&
                        !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                        const pos = getHexPosition(shape.row, col);
                        const distFromSpring = Math.sqrt(
                            Math.pow(pos.x - springCenterX, 2) + Math.pow(pos.z - springCenterZ, 2)
                        );
                        if (distFromSpring < 1.3) {
                            additionalWater.add(`${shape.row},${col}`);
                        }
                    }
                });
            });
            break;

        case 4: // Vallée avec rivières aléatoires
            // Générer 1-3 rivières courtes à travers l'île
            const numRivers = 1 + Math.floor(rand(seed * 400) * 3); // 1-3 rivières

            for (let r = 0; r < numRivers; r++) {
                // Point de départ aléatoire sur l'île
                const startAngle = rand(seed * (401 + r)) * Math.PI * 2;
                const startDistance = 3 + rand(seed * (402 + r)) * 2; // 3-5 unités du centre
                const startX = Math.cos(startAngle) * startDistance; // Centré sur (0,0)
                const startZ = Math.sin(startAngle) * startDistance;

                // Direction de la rivière (vers le centre ou tangentielle)
                const riverAngle = rand(seed * (403 + r)) * Math.PI * 2;
                const riverLength = 4 + rand(seed * (404 + r)) * 3; // 4-7 unités

                // Créer la rivière par segments
                const segments = 6 + Math.floor(rand(seed * (405 + r)) * 4); // 6-9 segments
                for (let s = 0; s < segments; s++) {
                    const t = s / (segments - 1); // 0 à 1

                    // Position le long de la rivière avec sinuosité
                    const sinuosity = Math.sin(t * Math.PI * 3 + seed * (406 + r)) * 0.5;
                    const riverX = startX + Math.cos(riverAngle) * t * riverLength +
                        Math.cos(riverAngle + Math.PI / 2) * sinuosity;
                    const riverZ = startZ + Math.sin(riverAngle) * t * riverLength +
                        Math.sin(riverAngle + Math.PI / 2) * sinuosity;

                    // Trouver la tuile hexagonale la plus proche
                    islandShape.forEach(shape => {
                        shape.cols.forEach(col => {
                            if (typeof shape.row === 'number' && typeof col === 'number' &&
                                !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                                const pos = getHexPosition(shape.row, col);
                                const distFromRiver = Math.sqrt(
                                    Math.pow(pos.x - riverX, 2) + Math.pow(pos.z - riverZ, 2)
                                );
                                if (distFromRiver < 0.8) { // Largeur de rivière
                                    additionalWater.add(`${shape.row},${col}`);
                                }
                            }
                        });
                    });
                }
            }
            break;
    }

    // GARANTIE RENFORCÉE : S'assurer qu'il y ait TOUJOURS de l'eau
    const totalWater = riverPath.size + additionalWater.size;
    if (totalWater === 0) {
        console.log("⚠️ Aucune eau détectée, création d'urgence d'un lac");

        // Créer un lac de secours GARANTI
        const fallbackX = (rand(seed * 500) - 0.5) * 3; // Proche de (0,0)
        const fallbackZ = (rand(seed * 501) - 0.5) * 3;

        // Lac plus grand pour être sûr qu'il soit visible
        islandShape.forEach(shape => {
            shape.cols.forEach(col => {
                if (typeof shape.row === 'number' && typeof col === 'number' &&
                    !isNaN(shape.row) && !isNaN(col) && isFinite(shape.row) && isFinite(col)) {
                    const pos = getHexPosition(shape.row, col);
                    const distFromFallback = Math.sqrt(
                        Math.pow(pos.x - fallbackX, 2) + Math.pow(pos.z - fallbackZ, 2)
                    );
                    if (distFromFallback < 2.0) { // Lac plus grand
                        additionalWater.add(`${shape.row},${col}`);
                    }
                }
            });
        });
    }

    // Double vérification après le fallback
    const finalWaterCount = riverPath.size + additionalWater.size;
    if (finalWaterCount === 0) {
        console.log("🚨 ERREUR : Toujours pas d'eau après fallback!");

        // Force un lac au centre exact (0,0)
        const centerShape = islandShape.find(s => s.row === 0);
        if (centerShape && centerShape.cols.includes(0)) {
            additionalWater.add("0-0"); // Centre exact
            additionalWater.add("0-1"); // Voisins
            additionalWater.add("0--1");
            additionalWater.add("-1-0");
            additionalWater.add("1-0");
        }
    }

    // Génération des couleurs
    const waterColor = generateWaterColor(seed);
    const landColors = generateLandColors(seed);

    // Créer les tuiles SANS trous avec validation renforcée
    islandShape.forEach(({ row, cols }) => {
        cols.forEach((col) => {
            // Validation stricte des coordonnées
            const validRow = validateNumber(row);
            const validCol = validateNumber(col);

            if (validRow !== row || validCol !== col) {
                console.warn(`⚠️ Coordonnées corrigées: (${row}, ${col}) → (${validRow}, ${validCol})`);
            }

            const pos = getHexPosition(validRow, validCol, centerRow, centerCol);

            // Validation de la position générée
            const validPos = validatePosition([pos.x, pos.z, 0]);
            if (validPos[0] !== pos.x || validPos[1] !== pos.z) {
                console.warn(`⚠️ Position corrigée: (${pos.x}, ${pos.z}) → (${validPos[0]}, ${validPos[1]})`);
                pos.x = validPos[0];
                pos.z = validPos[1];
            }

            const key = validateKey(validRow, validCol);
            const isRiver = riverPath.has(key);
            const isAdditionalWater = additionalWater.has(key);

            if (isRiver || isAdditionalWater) {
                const waterPos = validatePosition([pos.x, WATER_DEPTH, pos.z]);
                water.push({
                    position: waterPos,
                    height: validateNumber(0.2, 0.2),
                    color: waterColor,
                    type: "water",
                    key,
                });
            } else {
                // Calcul de la hauteur progressive GARANTIE
                const rawHeight = calculateProgressiveHeight(pos, features, seed);
                const height = validateNumber(rawHeight, 0.3);

                if (height !== rawHeight) {
                    console.warn(`⚠️ Hauteur corrigée: ${rawHeight} → ${height} pour ${key}`);
                }

                // Couleurs selon l'altitude
                let color = landColors.low;
                if (height > 1.8) color = landColors.high;      // Sommets
                else if (height > 0.8) color = landColors.base; // Moyennes altitudes
                else color = landColors.low;                     // Basses terres

                const landPos = validatePosition([pos.x, height / 2, pos.z]);
                land.push({
                    position: landPos,
                    height,
                    color,
                    type: "land",
                    key,
                });

                // Placement intelligent des rochers selon terrain et altitude
                let rockChance = 0.005; // Base réduite
                let rockScale = 0.4;
                let rockVariety = 0;

                // Augmentation selon l'altitude
                if (height > 1.2) rockChance += 0.02;
                if (height > 1.8) rockChance += 0.04;
                if (height > 2.5) rockChance += 0.08;

                // Variations selon le type de terrain
                switch (terrainType) {
                    case 0: // Relief concentrique - rochers près des sommets
                        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
                        if (distFromCenter < 4) rockChance += 0.06; // Centre montagneux
                        rockScale = 0.5;
                        rockVariety = 0; // Rochers volcaniques
                        break;
                    case 1: // Relief en bandes - rochers le long des crêtes
                        if (height > 1.5) rockChance += 0.05;
                        rockScale = 0.3;
                        rockVariety = 1; // Rochers de crête
                        break;
                    case 2: // Relief aléatoire - rochers dispersés
                        rockChance += 0.03;
                        rockScale = 0.2 + rand(seed * 400 + pos.x + pos.z) * 0.5;
                        rockVariety = Math.floor(rand(seed * 401 + pos.x + pos.z) * 3); // Variés
                        break;
                    case 3: // Relief côtier - rochers aux falaises
                        const coastDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
                        if (coastDist > 8 && height > 1.0) rockChance += 0.08; // Falaises
                        rockScale = 0.6;
                        rockVariety = 2; // Rochers côtiers
                        break;
                }

                if (rand(seed * 300 + pos.x * 10 + pos.z * 10) < rockChance) {
                    // Couleurs selon le type de roche
                    const rockColors = [
                        "#555555", // Volcanique sombre
                        "#777777", // Crête grise
                        "#666666", // Variée
                        "#888888"  // Côtière claire
                    ];

                    const rockX = pos.x + (rand(seed * 301 + pos.x) - 0.5) * 0.3;
                    const rockZ = pos.z + (rand(seed * 302 + pos.z) - 0.5) * 0.3;
                    const rockPos = validatePosition([rockX, height, rockZ]);
                    const rockScaleValue = validateNumber(rockScale + rand(seed * 303 + pos.x + pos.z) * 0.4, 0.4);

                    rockPositions.push({
                        position: rockPos,
                        scale: rockScaleValue,
                        color: rockColors[rockVariety] || "#555555",
                        type: validateNumber(rockVariety, 0)
                    });
                }
            }
        });
    });

    // Placement aléatoire des maisons sur des cellules en hauteur
    const landTilesForHouses = land.filter(tile => tile.height > 0.8 && tile.height < 2.0); // Cellules en hauteur modérées

    for (let i = 0; i < 1 && i < landTilesForHouses.length; i++) {
        // Sélectionner une tuile aléatoire parmi celles en hauteur
        const tileIndex = Math.floor(rand(seed * (700 + i)) * landTilesForHouses.length);
        const selectedTile = landTilesForHouses[tileIndex];

        // Retirer la tuile sélectionnée pour éviter les doublons
        landTilesForHouses.splice(tileIndex, 1);

        // Vérifier qu'il n'y a pas de conflit avec les cellules voisines (éviter les chevauchements)
        const houseX = selectedTile.position[0] + (rand(seed * (800 + i)) - 0.5) * 0.5;
        const houseZ = selectedTile.position[2] + (rand(seed * (801 + i)) - 0.5) * 0.5;
        const houseY = selectedTile.position[1] + selectedTile.height / 2 - 0.3; // Surélever légèrement

        housePositions.push({
            position: validatePosition([houseX, houseY, houseZ]),
            scale: validateNumber(0.008 + rand(seed * (802 + i)) * 0.004, 0.008), // Échelle adaptée
            rotation: validateNumber(rand(seed * (803 + i)) * Math.PI * 2, 0) // Rotation aléatoire
        });
    }

    return {
        landTiles: land,
        waterTiles: water,
        rocks: rockPositions,
        houses: housePositions,
        totalTiles: land.length,
        waterColor,
    };
};

export const enlargeIsland = (seed: number, currentIslandData: IslandGenerationResult): IslandGenerationResult => {
    console.log("🔄 Agrandissement avec préservation complète du contenu");

    // Extraire les coordonnées existantes des tuiles terrestres
    const existingLandTiles = new Set<string>();
    currentIslandData.landTiles.forEach(tile => {
        existingLandTiles.add(tile.key);
    });

    // Calculer le rayon actuel basé sur les tuiles existantes
    let currentRadius = 0;
    currentIslandData.landTiles.forEach(tile => {
        // Retrouver les coordonnées row/col depuis la clé
        const [rowStr, colStr] = tile.key.split(',');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);
        const distance = Math.sqrt(row * row + col * col);
        currentRadius = Math.max(currentRadius, distance);
    });

    const newRadius = Math.ceil(currentRadius) + 2; // Augmenter de 2
    console.log(`📏 Agrandissement: rayon ${currentRadius.toFixed(1)} → ${newRadius}`);

    // Générer une nouvelle île avec le rayon augmenté
    const newIslandShape = generateIslandShape(seed, newRadius);
    const newIslandData = generateIsland(seed, newIslandShape);

    // Préserver EXACTEMENT les tuiles existantes en les remplaçant dans les nouvelles données
    const preservedLandTiles: TileData[] = [];
    const newLandTiles: TileData[] = [];

    newIslandData.landTiles.forEach(newTile => {
        if (existingLandTiles.has(newTile.key)) {
            // Trouver la tuile originale correspondante
            const originalTile = currentIslandData.landTiles.find(t => t.key === newTile.key);
            if (originalTile) {
                preservedLandTiles.push(originalTile); // Garder l'originale exactement
            } else {
                preservedLandTiles.push(newTile); // Fallback
            }
        } else {
            newLandTiles.push({ ...newTile, isNew: true }); // Nouvelle tuile ajoutée avec marqueur
        }
    });

    console.log(`✅ Préservé: ${preservedLandTiles.length}, Ajouté: ${newLandTiles.length}`);

    return {
        landTiles: [...preservedLandTiles, ...newLandTiles],
        waterTiles: newIslandData.waterTiles, // Nouvelles eaux
        rocks: [
            ...currentIslandData.rocks, // Garder les rochers existants
            ...newIslandData.rocks.filter(newRock => {
                // Ajouter seulement les nouveaux rochers (pas sur les anciennes tuiles)
                const rockKey = `${Math.round(newRock.position[0] / 1.5)},${Math.round(newRock.position[2] / 1.3)}`;
                return !existingLandTiles.has(rockKey);
            })
        ],
        houses: [
            ...currentIslandData.houses, // Garder les maisons existantes
            ...newIslandData.houses.filter(newHouse => {
                // Ajouter seulement les nouvelles maisons (pas sur les anciennes tuiles)
                const houseKey = `${Math.round(newHouse.position[0] / 1.5)},${Math.round(newHouse.position[2] / 1.3)}`;
                return !existingLandTiles.has(houseKey);
            })
        ],
        totalTiles: preservedLandTiles.length + newLandTiles.length,
        waterColor: currentIslandData.waterColor // Garder la couleur d'eau existante
    };
};

export const generateIslandFromShape = (seed: number, islandShape: any[]): IslandGenerationResult => {
    console.log("🏗️ Génération île simple depuis forme...");

    const land: TileData[] = [];
    const water: TileData[] = [];
    const rockPositions: RockData[] = [];
    const housePositions: HouseData[] = [];

    // Couleurs simples
    const waterColor = "#1e88e5";
    const landColor = "#66bb6a";

    // Convertir chaque tuile de la forme en tuile 3D
    islandShape.forEach(({ row, cols }) => {
        cols.forEach((col) => {
            // Vérifier que row et col sont valides
            if (typeof row !== 'number' || typeof col !== 'number' ||
                isNaN(row) || isNaN(col) || !isFinite(row) || !isFinite(col)) {
                console.warn(`❌ Coordonnées invalides: row=${row}, col=${col}`);
                return;
            }

            const key = `${row},${col}`;

            // Position hexagonale simple
            const x = col * 1.5;
            const z = row * 1.3 + (col % 2) * 0.65;

            const rand = (s: number) => {
                const x = Math.sin(s) * 10000;
                return x - Math.floor(x);
            };
            const height = 0.5 + rand(seed * 9000 + row * 100 + col) * 0.3; // Hauteur aléatoire simple

            // Vérifier que la position est valide
            if (isNaN(x) || isNaN(z) || isNaN(height) ||
                !isFinite(x) || !isFinite(z) || !isFinite(height)) {
                console.warn(`❌ Position invalide: x=${x}, z=${z}, height=${height}`);
                return;
            }

            land.push({
                position: [x, height / 2, z],
                height,
                color: landColor,
                type: "land",
                key,
            });
        });
    });

    console.log(`✅ ${land.length} tuiles générées avec succès`);

    return {
        landTiles: land,
        waterTiles: water,
        rocks: rockPositions,
        houses: housePositions,
        totalTiles: land.length,
        waterColor,
    };
};