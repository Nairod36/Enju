import React, { useRef, useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TileData, TreeData, CharacterData, ChestData } from "./island.types";
import { HEX_RADIUS } from "./island.const";
import { useModels } from "../../../hooks/useModels";

// ===== COMPOSANTS 3D =====

// Tuile hexagonale animée
export const HexTile: React.FC<{
  data: TileData;
  delay: number;
  onAnimationComplete: () => void;
}> = ({ data, delay, onAnimationComplete }) => {
  const [visible, setVisible] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useFrame((state, delta) => {
    if (meshRef.current && visible) {
      // Animation d'apparition
      scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, 1, delta * 3);
      meshRef.current.scale.set(1, scaleRef.current, 1);

      if (scaleRef.current > 0.99 && !meshRef.current.userData.completed) {
        meshRef.current.userData.completed = true;
        onAnimationComplete();
      }
    }
  });

  if (!visible) return null;

  // Validate position to prevent NaN errors
  const validPosition = data.position.map(val => 
    typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0
  ) as [number, number, number];
  
  const validHeight = typeof data.height === 'number' && !isNaN(data.height) && isFinite(data.height) 
    ? data.height : 0.2;

  return (
    <mesh
      ref={meshRef}
      position={validPosition}
      scale={[1, 0, 1]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, validHeight, 6]} />
      <meshStandardMaterial
        color={data.color}
        roughness={data.type === "water" ? 0.3 : 0.8}
        metalness={data.type === "water" ? 0.1 : 0}
      />
    </mesh>
  );
};

// Tuile d'eau animée avec texture
export const WaterTile: React.FC<{
  position: [number, number, number];
  delay: number;
  color: string;
}> = ({ position, delay, color }) => {
  const [visible, setVisible] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const timeOffset = useRef(Math.random() * Math.PI * 2);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useFrame(({ clock }) => {
    if (meshRef.current && visible) {
      // Animation de vagues
      const wave1 =
        Math.sin(clock.elapsedTime * 0.5 + timeOffset.current) * 0.02;
      const wave2 =
        Math.cos(clock.elapsedTime * 0.3 + position[0] * 0.1) * 0.01;
      meshRef.current.position.y = position[1] + wave1 + wave2;

      // Rotation subtile
      meshRef.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.1 + timeOffset.current) * 0.05;
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={position} receiveShadow>
      <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, 0.2, 6]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.85}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  );
};

// Arbre animé qui pousse
export const AnimatedTree: React.FC<{
  data: TreeData;
  onRemove: (id: string) => void;
}> = ({ data, onRemove }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [growth, setGrowth] = useState(0);

  useFrame((state, delta) => {
    // Animation de croissance
    const age = (Date.now() - data.birthTime) / 1000; // âge en secondes
    const targetGrowth = Math.min(age / 2, 1); // 2 secondes pour grandir
    setGrowth(THREE.MathUtils.lerp(growth, targetGrowth, delta * 2));

    if (groupRef.current) {
      groupRef.current.scale.set(
        data.scale * growth,
        data.scale * growth,
        data.scale * growth
      );

      // Petite rotation pendant la croissance
      if (growth < 1) {
        groupRef.current.rotation.y += delta * 1.1;
      }
    }
  });

  const treeColor = useMemo(() => {
    const colors = ["#0d5f0d", "#1a7a1a", "#0f4f0f", "#2d8b2d", "#228b22"];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  return (
    <group ref={groupRef} position={data.position}>
      {/* Particules de croissance */}
      {growth < 0.5 && (
        <mesh key="growth-particles" position={[0, growth * 2, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial
            color="#90ee90"
            emissive="#90ee90"
            emissiveIntensity={0.5}
            transparent
            opacity={0.5 - growth}
          />
        </mesh>
      )}

      {/* Tronc */}
      <mesh key="trunk" position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.3, 6]} />
        <meshStandardMaterial color="#3e2918" roughness={1} />
      </mesh>

      {/* Feuillage - 3 niveaux */}
      <mesh key="foliage-1" position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.4, 0.6, 6]} />
        <meshStandardMaterial color={treeColor} roughness={0.9} />
      </mesh>
      <mesh key="foliage-2" position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color={treeColor} roughness={0.9} />
      </mesh>
      {growth > 0.7 && (
        <mesh key="foliage-3" position={[0, 1.15, 0]} castShadow>
          <coneGeometry args={[0.2, 0.4, 6]} />
          <meshStandardMaterial color={treeColor} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
};

// Rocher décoratif avec variété
export const Rock: React.FC<{
  position: [number, number, number];
  scale: number;
  color?: string;
  type?: number;
}> = ({ position, scale, color = "#555555", type = 0 }) => {
  // Géométries variées selon le type
  const geometries = [
    <dodecahedronGeometry key="volcanic" args={[0.2, 0]} />, // Volcanique - forme complexe
    <octahedronGeometry key="ridge" args={[0.25, 0]} />,  // Crête - forme pointue  
    <icosahedronGeometry key="varied" args={[0.22, 0]} />, // Variée - forme irrégulière
    <boxGeometry key="coastal" args={[0.3, 0.2, 0.25]} />   // Côtière - forme érodée
  ];

  return (
    <mesh
      position={position}
      scale={[scale, scale * 0.7, scale]}
      castShadow
      receiveShadow
    >
      {geometries[type] || geometries[0]}
      <meshStandardMaterial 
        color={color} 
        roughness={0.9 + Math.random() * 0.1} 
        metalness={0.1} 
      />
    </mesh>
  );
};

// Maison placée aléatoirement
export const House: React.FC<{
  position: [number, number, number];
  scale?: number;
  rotation?: number;
}> = ({ position, scale = 0.01, rotation = 0 }) => {
  const { littleHouse } = useModels();
  
  if (!littleHouse) return null;

  return (
    <group 
      position={[position[0], position[1] + 0.3, position[2]]} 
      scale={[scale, scale, scale]}
      rotation={[0, rotation, 0]}
      castShadow 
      receiveShadow
    >
      <primitive object={littleHouse.clone()} />
    </group>
  );
};

// Personnage qui se déplace intelligemment sur l'île
export const GenericMale: React.FC<{
  character: CharacterData;
  landTiles: TileData[];
  obstacles: Array<{ position: [number, number, number]; radius: number }>;
  onCharacterUpdate: (character: CharacterData) => void;
}> = ({ character, landTiles, obstacles, onCharacterUpdate }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { genericMale } = useModels();

  // Mouvement simple en cercle pour tester
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.elapsedTime;
    const radius = 3;
    const speed = 0.5;
    
    const x = Math.cos(time * speed) * radius;
    const z = Math.sin(time * speed) * radius;
    const y = character.position[1]; // Garder la hauteur initiale
    
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = time * speed + Math.PI / 2; // Orienter dans la direction du mouvement
    
    // Mettre à jour le character pour le parent
    const updatedCharacter = {
      ...character,
      position: [x, y, z] as [number, number, number],
      direction: time * speed + Math.PI / 2,
      state: 'walking' as const
    };
    
    onCharacterUpdate(updatedCharacter);
  });

  if (!genericMale) {
    console.log("🚫 Modèle GenericMale pas encore chargé");
    return (
      <group ref={groupRef} position={character.position}>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
      </group>
    );
  }

  console.log("✅ Rendu du personnage GenericMale");

  return (
    <group ref={groupRef} position={character.position}>
      <primitive 
        object={genericMale.clone()} 
        scale={[0.01, 0.01, 0.01]}
        castShadow
        receiveShadow
      />
      
      {/* Grosse sphère rouge pour debug */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial 
          color="#ff0000" 
          emissive="#ff0000" 
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
};

// Coffre qui peut apparaître sur l'île
export const Chest: React.FC<{
  chest: ChestData;
  onChestClick?: (chestId: string) => void;
}> = ({ chest, onChestClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Animation de flottement subtile
      groupRef.current.position.y = chest.position[1] + Math.sin(clock.elapsedTime * 2) * 0.01;
      
      // Animation d'ouverture
      if (chest.isOpen && groupRef.current.children[1]) {
        (groupRef.current.children[1] as THREE.Mesh).rotation.x = -Math.PI / 3;
      }
    }
  });

  const handleClick = () => {
    if (onChestClick) {
      onChestClick(chest.id);
    }
  };

  return (
    <group 
      ref={groupRef} 
      position={chest.position} 
      scale={[chest.scale, chest.scale, chest.scale]}
      rotation={[0, chest.rotation, 0]}
      onClick={handleClick}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Base du coffre */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.2, 0.3]} />
        <meshStandardMaterial 
          color={hover ? "#8b4513" : "#654321"} 
          roughness={0.8}
        />
      </mesh>
      
      {/* Couvercle du coffre */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.32]} />
        <meshStandardMaterial 
          color={hover ? "#8b4513" : "#654321"} 
          roughness={0.8}
        />
      </mesh>
      
      {/* Fermeture dorée */}
      <mesh position={[0, 0.05, 0.16]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial 
          color="#ffd700" 
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>

      {/* Particules dorées si ouvert */}
      {chest.isOpen && (
        <>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial 
              color="#ffd700" 
              emissive="#ffd700"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[0.1, 0.25, 0.1]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshStandardMaterial 
              color="#ffd700" 
              emissive="#ffd700"
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[-0.1, 0.28, -0.1]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial 
              color="#ffd700" 
              emissive="#ffd700"
              emissiveIntensity={0.4}
            />
          </mesh>
        </>
      )}
    </group>
  );
};
