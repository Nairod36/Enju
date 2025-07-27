// src/hooks/useModels.ts

import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// Définition des modèles chargés
export interface Models {
    littleHouse: THREE.Group;
    genericMale: THREE.Group;
}

// Hook pour charger tous les FBX
export function useModels(): Models {
    const [littleHouse, genericMale] = useLoader(FBXLoader, [
        '/3d/little_house.fbx',
        '/3d/GenericMale.fbx',
    ]) as THREE.Group[];

    return {
        littleHouse,
        genericMale,
    };
}
