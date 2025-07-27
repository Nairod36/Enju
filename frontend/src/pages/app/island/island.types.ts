// ===== TYPES ET INTERFACES =====

export interface HexPosition {
    x: number;
    z: number;
    row: number;
    col: number;
}

export interface TileData {
    position: [number, number, number];
    height: number;
    color: string;
    type: "land" | "water";
    key: string;
    isNew?: boolean; // Pour identifier les nouvelles tuiles lors de l'agrandissement
}

export interface TreeData {
    id: string;
    position: [number, number, number];
    scale: number;
    birthTime: number;
}

export interface RockData {
    position: [number, number, number];
    scale: number;
    color?: string;
    type?: number;
}

export interface HouseData {
    position: [number, number, number];
    scale: number;
    rotation: number;
}

export interface IslandShape {
    row: number;
    cols: number[];
}

export interface ColorPalette {
    base: string;
    high: string;
    low: string;
}

export interface CharacterData {
    id: string;
    position: [number, number, number];
    targetPosition?: [number, number, number];
    speed: number;
    direction: number;
    state: 'idle' | 'walking' | 'waiting';
    lastPositionUpdate: number;
}

export interface ChestData {
    id: string;
    position: [number, number, number];
    rotation: number;
    scale: number;
    isOpen: boolean;
}

export interface IslandGenerationResult {
    landTiles: TileData[];
    waterTiles: TileData[];
    rocks: RockData[];
    houses: HouseData[];
    totalTiles: number;
    waterColor: string;
}

export interface SavedIslandState {
    id: string;
    name: string;
    seed: number;
    createdAt: number;
    lastModified: number;
    baseIslandData: IslandGenerationResult;
    userTrees: TreeData[];
    chests: ChestData[];
    usedTiles: string[];
    treeCount: number;
    version: string; // Version du format de sauvegarde
}