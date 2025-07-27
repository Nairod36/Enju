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

export interface IslandShape {
    row: number;
    cols: number[];
}

export interface ColorPalette {
    base: string;
    high: string;
    low: string;
}

export interface IslandGenerationResult {
    landTiles: TileData[];
    waterTiles: TileData[];
    rocks: RockData[];
    totalTiles: number;
    waterColor: string;
}