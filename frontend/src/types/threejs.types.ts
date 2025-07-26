import * as THREE from "three";

export interface TileInfo {
    type: string;
    elevation: number;
}

export interface HexTileProps {
    position: [number, number, number];
    height: number;
    info: TileInfo;
}

export interface Placement {
    key: string;
    model: THREE.Group;
    position: [number, number, number];
    scale: number;
}
