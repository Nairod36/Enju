// src/hooks/useModels.ts

import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// Définition des modèles chargés
export interface Models {
    spruce1: THREE.Group;
    spruce2: THREE.Group;
    spruce3: THREE.Group;
    spruce4: THREE.Group;
    spruce5: THREE.Group;
    spruce6: THREE.Group;
    spruce7: THREE.Group;
    spruce8: THREE.Group;
    spruce9: THREE.Group;
    spruce10: THREE.Group;
    spruceDead1: THREE.Group;
    spruceDead2: THREE.Group;
    spruceDead3: THREE.Group;
    // Texture pour les matériaux
    spruceMat: THREE.Texture;
}

// Hook pour charger tous les FBX
export function useModels(): Models {
    const [
        spruce1,
        spruce2,
        spruce3,
        spruce4,
        spruce5,
        spruce6,
        spruce7,
        spruce8,
        spruce9,
        spruce10,
        spruceDead1,
        spruceDead2,
        spruceDead3
    ] = useLoader(FBXLoader, [
        '/trees/Spruce_1.fbx',
        '/trees/Spruce_2.fbx',
        '/trees/Spruce_3.fbx',
        '/trees/Spruce_4.fbx',
        '/trees/Spruce_5.fbx',
        '/trees/Spruce_6.fbx',
        '/trees/Spruce_7.fbx',
        '/trees/Spruce_8.fbx',
        '/trees/Spruce_9.fbx',
        '/trees/Spruce_10.fbx',
        '/trees/Spruce_Dead_1.fbx',
        '/trees/Spruce_Dead_2.fbx',
        '/trees/Spruce_Dead_3.fbx',
    ]) as THREE.Group[];

    const [spruceMat] = useLoader(THREE.TextureLoader, [
        '/textures/Spruce_mat.png',
    ]) as THREE.Texture[];


    return {
        spruce1,
        spruce2,
        spruce3,
        spruce4,
        spruce5,
        spruce6,
        spruce7,
        spruce8,
        spruce9,
        spruce10,
        spruceDead1,
        spruceDead2,
        spruceDead3,
        spruceMat
    };
}
