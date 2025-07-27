import React, { useRef, useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TileData, TreeData } from "./island.types";
import { HEX_RADIUS } from "./island.const";

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
        <mesh position={[0, growth * 2, 0]}>
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
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.3, 6]} />
        <meshStandardMaterial color="#3e2918" roughness={1} />
      </mesh>

      {/* Feuillage - 3 niveaux */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.4, 0.6, 6]} />
        <meshStandardMaterial color={treeColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color={treeColor} roughness={0.9} />
      </mesh>
      {growth > 0.7 && (
        <mesh position={[0, 1.15, 0]} castShadow>
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
    <dodecahedronGeometry args={[0.2, 0]} />, // Volcanique - forme complexe
    <octahedronGeometry args={[0.25, 0]} />,  // Crête - forme pointue  
    <icosahedronGeometry args={[0.22, 0]} />, // Variée - forme irrégulière
    <boxGeometry args={[0.3, 0.2, 0.25]} />   // Côtière - forme érodée
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
