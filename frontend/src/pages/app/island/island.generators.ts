import { IslandShape, ColorPalette } from './island.types';
import { Noise } from 'noisejs';

// ===== GÉNÉRATEURS PROCÉDURAUX =====

export const generateIslandSeed = (): number => Math.random() * 1000;

const noiseMap: Record<number, Noise> = {};

/** Renvoie un bruit Perlin lisse dans [0,1] */
export const generateNoise = (x: number, z: number, seed: number): number => {
    // créer ou récupérer l’instance Noise(seed)
    if (!noiseMap[seed]) {
        noiseMap[seed] = new Noise(seed);
    }
    const n = noiseMap[seed].perlin2(x * 0.1, z * 0.1); // fréquence = 0.1 à ajuster
    return (n + 1) / 2; // map [-1,1] → [0,1]
};

export const generateIslandShape = (seed: number, baseRadius: number = 5): IslandShape[] => {
    const tiles = new Set<string>();
    // ALGORITHME CERCLE PARFAIT : utiliser l'équation du cercle x² + y² ≤ r²
    const radiusSquared = baseRadius * baseRadius;

    // Parcourir un carré englobant et garder seulement les points dans le cercle
    for (let row = -baseRadius; row <= baseRadius; row++) {
        for (let col = -baseRadius; col <= baseRadius; col++) {
            const distanceSquared = row * row + col * col;

            // Inclusion basée strictement sur l'équation du cercle
            if (distanceSquared <= radiusSquared) {
                tiles.add(`${row},${col}`);
            }
        }
    }

    // Convertir en format IslandShape
    const tilesByRow = new Map<number, number[]>();

    tiles.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);

        // Validate parsed values
        if (isNaN(row) || isNaN(col) || !isFinite(row) || !isFinite(col)) {
            console.warn(`❌ Invalid tile key: ${tileKey} -> row=${row}, col=${col}`);
            return;
        }

        if (!tilesByRow.has(row)) {
            tilesByRow.set(row, []);
        }
        tilesByRow.get(row)!.push(col);
    });

    // Trier et formater
    const result: IslandShape[] = [];
    Array.from(tilesByRow.keys()).sort((a, b) => a - b).forEach(row => {
        const cols = tilesByRow.get(row)!.sort((a, b) => a - b);
        result.push({ row, cols });
    });

    return result;
};

export const enlargeIslandShape = (currentShape: IslandShape[], seed: number, radiusIncrease: number = 1): IslandShape[] => {

    // ÉTAPE 1: Conserver EXACTEMENT toutes les tuiles existantes
    const existingTiles = new Set<string>();
    currentShape.forEach(shape => {
        shape.cols.forEach(col => {
            existingTiles.add(`${shape.row},${col}`);
        });
    });

    console.log(`📊 Tuiles à conserver: ${existingTiles.size}`);

    // ÉTAPE 2: Calculer le rayon actuel
    let currentRadius = 0;
    existingTiles.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);

        if (isNaN(row) || isNaN(col) || !isFinite(row) || !isFinite(col)) {
            console.warn(`❌ Invalid existing tile key: ${tileKey} -> row=${row}, col=${col}`);
            return;
        }

        const distance = Math.sqrt(row * row + col * col);
        currentRadius = Math.max(currentRadius, distance);
    });

    const newRadius = Math.ceil(currentRadius) + radiusIncrease;
    console.log(`📏 Rayon: ${currentRadius.toFixed(1)} → ${newRadius}`);

    // ÉTAPE 3: Générer un nouveau cercle plus grand
    const newCircleTiles = new Set<string>();
    const newRadiusSquared = newRadius * newRadius;

    for (let row = -newRadius; row <= newRadius; row++) {
        for (let col = -newRadius; col <= newRadius; col++) {
            const distanceSquared = row * row + col * col;
            if (distanceSquared <= newRadiusSquared) {
                newCircleTiles.add(`${row},${col}`);
            }
        }
    }

    // ÉTAPE 4: Combiner (toutes les anciennes + toutes les nouvelles dans le cercle)
    const finalTiles = new Set([...existingTiles, ...newCircleTiles]);

    // Convertir en format IslandShape
    const tilesByRow = new Map<number, number[]>();

    finalTiles.forEach(tileKey => {
        const [rowStr, colStr] = tileKey.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);

        if (isNaN(row) || isNaN(col) || !isFinite(row) || !isFinite(col)) {
            console.warn(`❌ Invalid final tile key: ${tileKey} -> row=${row}, col=${col}`);
            return;
        }

        if (!tilesByRow.has(row)) {
            tilesByRow.set(row, []);
        }
        tilesByRow.get(row)!.push(col);
    });

    const result: IslandShape[] = [];
    Array.from(tilesByRow.keys()).sort((a, b) => a - b).forEach(row => {
        const cols = tilesByRow.get(row)!.sort((a, b) => a - b);
        result.push({ row, cols });
    });

    return result;
};

export const generateRiverPattern = (seed: number, maxRow: number) => {
    const rand = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    // Décider s'il y a une rivière (70% de chance)
    if (rand(seed * 10.1) < 0.3) {
        return () => 999; // Pas de rivière
    }

    // Paramètres variables pour la rivière
    const riverType = Math.floor(rand(seed * 11.3) * 4);
    const amplitude = 1 + rand(seed * 12.7) * 2; // Amplitude des courbes
    const frequency = 0.3 + rand(seed * 13.9) * 0.8; // Fréquence des oscillations
    const offset = rand(seed * 14.1) * Math.PI * 2; // Décalage de phase
    const drift = (rand(seed * 15.5) - 0.5) * 0.3; // Dérive générale
    const complexity = 1 + Math.floor(rand(seed * 16.7) * 3); // Nombre d'harmoniques

    return (row: number) => {
        const normalizedRow = row / maxRow; // 0 à 1
        let position = 0;

        // Différents types de rivières
        switch (riverType) {
            case 0: // Rivière sinusoïdale simple
                position = Math.sin(normalizedRow * Math.PI * frequency + offset) * amplitude;
                break;

            case 1: // Rivière avec harmoniques
                for (let h = 1; h <= complexity; h++) {
                    const harmAmp = amplitude / h;
                    const harmFreq = frequency * h;
                    position += Math.sin(normalizedRow * Math.PI * harmFreq + offset * h) * harmAmp;
                }
                break;

            case 2: // Rivière en spirale
                const spiralRadius = amplitude * (0.5 + 0.5 * normalizedRow);
                const spiralAngle = normalizedRow * Math.PI * frequency * 4 + offset;
                position = Math.cos(spiralAngle) * spiralRadius;
                break;

            case 3: // Rivière avec méandres aléatoires
                position = 0;
                for (let octave = 1; octave <= complexity; octave++) {
                    const octaveAmp = amplitude / Math.pow(2, octave - 1);
                    const octaveFreq = frequency * Math.pow(2, octave - 1);
                    position += Math.sin(normalizedRow * Math.PI * octaveFreq + offset + octave) * octaveAmp;
                    position += Math.cos(normalizedRow * Math.PI * octaveFreq * 1.3 + offset + octave * 2) * octaveAmp * 0.7;
                }
                break;
        }

        // Ajouter une dérive générale
        position += drift * normalizedRow * maxRow * 0.1;

        return Math.round(position);
    };
};

export const generateWaterColor = (seed: number): string => {
    const colors = [
        "#1e88e5", // Bleu océan
        "#00acc1", // Cyan profond
        "#3949ab", // Bleu indigo
        "#00897b", // Teal foncé
        "#29b6f6", // Bleu ciel
        "#26a69a", // Turquoise
        "#0277bd", // Bleu foncé
        "#006064", // Cyan très foncé
        "#1565c0", // Bleu royal
        "#00838f", // Cyan grisé
    ];
    return colors[Math.floor(seed * colors.length) % colors.length];
};

export const generateLandColors = (seed: number): ColorPalette => {
    const colorSets = [
        // Forêt tempérée
        { base: "#66bb6a", high: "#2e7d32", low: "#a5d6a7" },
        // Automnal
        { base: "#d4a574", high: "#8b4513", low: "#f4a460" },
        // Tropical
        { base: "#4caf50", high: "#1b5e20", low: "#81c784" },
        // Savane
        { base: "#8bc34a", high: "#33691e", low: "#aed581" },
        // Méditerranéen
        { base: "#9ccc65", high: "#558b2f", low: "#c5e1a5" },
        // Désertique
        { base: "#ffb74d", high: "#e65100", low: "#ffcc02" },
        // Volcanique
        { base: "#8d6e63", high: "#3e2723", low: "#bcaaa4" },
        // Alpien
        { base: "#78909c", high: "#37474f", low: "#b0bec5" },
        // Prairie
        { base: "#7cb342", high: "#33691e", low: "#9ccc65" },
        // Côtier
        { base: "#689f38", high: "#1b5e20", low: "#8bc34a" },
        // Marécage
        { base: "#388e3c", high: "#1b5e20", low: "#66bb6a" },
        // Toundra
        { base: "#90a4ae", high: "#455a64", low: "#cfd8dc" },
    ];
    return colorSets[Math.floor(seed * colorSets.length) % colorSets.length];
};