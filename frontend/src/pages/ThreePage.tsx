import React, {
  useRef,
  useMemo,
  FC,
  useState,
  useEffect,
  useImperativeHandle,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";

// ===== TYPES =====
interface HexPosition {
  x: number;
  z: number;
  row: number;
  col: number;
}

interface TileData {
  position: [number, number, number];
  height: number;
  color: string;
  type: "land" | "water";
  key: string;
}

interface TreeData {
  id: string;
  position: [number, number, number];
  scale: number;
  birthTime: number;
}

// ===== CONSTANTES =====
const HEX_RADIUS = 1;
const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS;
const HEX_WIDTH = 2 * HEX_RADIUS;
const WATER_COLOR = "#2196f3";
const WATER_DEPTH = -0.2;

// ===== COMPOSANTS DE BASE =====

// Tuile hexagonale animée
const HexTile: FC<{
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

  return (
    <mesh
      ref={meshRef}
      position={data.position}
      scale={[1, 0, 1]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, data.height, 6]} />
      <meshStandardMaterial
        color={data.color}
        roughness={data.type === "water" ? 0.3 : 0.8}
        metalness={data.type === "water" ? 0.1 : 0}
      />
    </mesh>
  );
};

// Tuile d'eau animée avec texture
const WaterTile: FC<{ position: [number, number, number]; delay: number }> = ({
  position,
  delay,
}) => {
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
        color={WATER_COLOR}
        transparent
        opacity={0.85}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  );
};

// Arbre animé qui pousse
const AnimatedTree: FC<{ data: TreeData; onRemove: (id: string) => void }> = ({
  data,
  onRemove,
}) => {
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

// Rocher décoratif
const Rock: FC<{ position: [number, number, number]; scale: number }> = ({
  position,
  scale,
}) => (
  <mesh
    position={position}
    scale={[scale, scale * 0.7, scale]}
    castShadow
    receiveShadow
  >
    <dodecahedronGeometry args={[0.2, 0]} />
    <meshStandardMaterial color="#555555" roughness={1} />
  </mesh>
);

// ===== COMPOSANT PRINCIPAL =====
const FloatingIsland = React.forwardRef<
  {
    addRandomTree: () => void;
  },
  {}
>((props, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const [animatedTiles, setAnimatedTiles] = useState(0);
  const [showDecorations, setShowDecorations] = useState(false);
  const [userTrees, setUserTrees] = useState<TreeData[]>([]);
  const [usedTiles, setUsedTiles] = useState<Set<string>>(new Set());

  // Calcul de la position hexagonale
  const getHexPosition = (row: number, col: number): HexPosition => {
    // Décalage pour les rangées impaires
    const offset = row % 2 === 0 ? 0 : HEX_WIDTH * 0.5;
    return {
      x: col * HEX_WIDTH * 0.75 + offset,
      z: row * HEX_HEIGHT * 0.5,
      row,
      col,
    };
  };

  // Génération de l'île
  const { landTiles, waterTiles, paths, rocks, totalTiles } = useMemo(() => {
    const land: TileData[] = [];
    const water: TileData[] = [];
    const pathConnections: Array<{
      start: [number, number, number];
      end: [number, number, number];
    }> = [];
    const rockPositions: Array<{
      position: [number, number, number];
      scale: number;
    }> = [];

    // Forme de l'île
    const islandShape = [
      { row: 0, cols: [-2, -1, 0, 1, 2] },
      { row: 1, cols: [-3, -2, -1, 0, 1, 2, 3] },
      { row: 2, cols: [-3, -2, -1, 0, 1, 2, 3] },
      { row: 3, cols: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { row: 4, cols: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { row: 5, cols: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { row: 6, cols: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { row: 7, cols: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { row: 8, cols: [-3, -2, -1, 0, 1, 2, 3] },
      { row: 9, cols: [-3, -2, -1, 0, 1, 2, 3] },
      { row: 10, cols: [-2, -1, 0, 1, 2] },
    ];

    // Définir la rivière (colonne centrale avec variations)
    const riverPath = new Set<string>();
    for (let row = 0; row <= 10; row++) {
      const variation = Math.sin(row * 0.5) * 1.5;
      const col = Math.round(variation);
      riverPath.add(`${row}-${col}`);
      // Élargir la rivière
      if (row >= 3 && row <= 7) {
        riverPath.add(`${row}-${col - 1}`);
        riverPath.add(`${row}-${col + 1}`);
      }
    }

    // Créer les tuiles
    islandShape.forEach(({ row, cols }) => {
      cols.forEach((col) => {
        const pos = getHexPosition(row, col);
        const key = `${row}-${col}`;
        const isWater = riverPath.has(key);

        // Calcul de la hauteur basé sur la distance du centre
        const distance = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const noise = Math.sin(pos.x * 0.3) * Math.cos(pos.z * 0.3) * 0.2;
        let height = Math.max(0.3, 1.2 - distance * 0.15 + noise);

        if (isWater) {
          water.push({
            position: [pos.x, WATER_DEPTH, pos.z],
            height: 0.2,
            color: WATER_COLOR,
            type: "water",
            key,
          });
        } else {
          // Variation de couleur selon la hauteur
          let color = "#7ed956";
          if (height > 0.9) color = "#5fa73a";
          else if (height < 0.5) color = "#9bc760";

          land.push({
            position: [pos.x, height / 2, pos.z],
            height,
            color,
            type: "land",
            key,
          });

          // Ajouter des rochers occasionnels
          if (Math.random() < 0.05) {
            rockPositions.push({
              position: [
                pos.x + (Math.random() - 0.5) * 0.5,
                height,
                pos.z + (Math.random() - 0.5) * 0.5,
              ],
              scale: 0.5 + Math.random() * 0.5,
            });
          }
        }
      });
    });

    // Créer des chemins logiques entre certaines tuiles
    const pathTiles = land.filter(
      (tile) => tile.height > 0.4 && tile.height < 0.8 && Math.random() < 0.2
    );

    // Connecter les tuiles de chemin proches
    for (let i = 0; i < pathTiles.length - 1; i++) {
      const current = pathTiles[i];
      const next = pathTiles[i + 1];
      const distance = Math.sqrt(
        Math.pow(next.position[0] - current.position[0], 2) +
          Math.pow(next.position[2] - current.position[2], 2)
      );

      if (distance < 3) {
        pathConnections.push({
          start: [
            current.position[0],
            current.position[1] + current.height / 2,
            current.position[2],
          ],
          end: [
            next.position[0],
            next.position[1] + next.height / 2,
            next.position[2],
          ],
        });
      }
    }

    return {
      landTiles: land,
      waterTiles: water,
      paths: pathConnections,
      rocks: rockPositions,
      totalTiles: land.length,
    };
  }, []);

  useImperativeHandle(ref, () => ({
    addRandomTree: () => {
      if (!landTiles || landTiles.length === 0) {
        console.warn("❌ landTiles non disponibles");
        return;
      }

      const availableTiles = landTiles.filter(
        (tile) => !usedTiles.has(tile.key)
      );

      console.log("🌿 Tuiles disponibles pour arbre :", availableTiles.length);

      if (availableTiles.length === 0) {
        console.warn("❌ Plus de tuiles disponibles pour planter");
        return;
      }

      const tile =
        availableTiles[Math.floor(Math.random() * availableTiles.length)];

      const newTree: TreeData = {
        id: `tree-${Date.now()}-${Math.random()}`,
        position: [
          tile.position[0] + (Math.random() - 0.5) * 0.3,
          tile.position[1] + tile.height / 2,
          tile.position[2] + (Math.random() - 0.5) * 0.3,
        ],
        scale: 0.6 + Math.random() * 0.4,
        birthTime: Date.now(),
      };

      setUserTrees((prev) => [...prev, newTree]);
      setUsedTiles((prev) => new Set(prev).add(tile.key));

      console.log("✅ Arbre ajouté sur la tuile :", tile.key);
    },
  }));

  // Gestion de l'animation progressive
  useEffect(() => {
    if (animatedTiles >= totalTiles * 0.8) {
      setShowDecorations(true);
    }
  }, [animatedTiles, totalTiles]);

  // Animation de flottement
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.2) * 0.2;
      groupRef.current.rotation.y = clock.elapsedTime * 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Terrain */}
      {landTiles.map((tile, index) => (
        <HexTile
          key={tile.key}
          data={tile}
          delay={index * 30}
          onAnimationComplete={() => setAnimatedTiles((prev) => prev + 1)}
        />
      ))}

      {/* Eau */}
      {waterTiles.map((tile, index) => (
        <WaterTile
          key={tile.key}
          position={tile.position}
          delay={1000 + index * 20}
        />
      ))}

      {/* Décorations */}
      {showDecorations && (
        <>
          {/* Rochers */}
          {rocks.map((rock, index) => (
            <Rock
              key={`rock-${index}`}
              position={rock.position}
              scale={rock.scale}
            />
          ))}
        </>
      )}

      {/* Arbres ajoutés par l'utilisateur */}
      {userTrees.map((tree) => (
        <AnimatedTree
          key={tree.id}
          data={tree}
          onRemove={(id) =>
            setUserTrees((prev) => prev.filter((t) => t.id !== id))
          }
        />
      ))}
    </group>
  );
}) as React.ForwardRefExoticComponent<{}>;

// ===== COMPOSANT PRINCIPAL =====
export const ThreePage: FC = () => {
  const [treeCount, setTreeCount] = useState(0);
  const [islandKey, setIslandKey] = useState(0);
  const islandRef = useRef<{ addRandomTree: () => void }>(null);
  const [usedTiles, setUsedTiles] = useState<Set<string>>(new Set());

  // Fonction pour ajouter un arbre aléatoire
  const handleAddTree = () => {
    console.log("Tentative d'ajout d'un arbre...");
    if (islandRef.current) {
      islandRef.current.addRandomTree();
      console.log("Arbre ajouté !");
      setTreeCount((prev) => prev + 1);
    }
  };

  // Fonction pour régénérer l'île
  const handleRegenerate = () => {
    setIslandKey((prev) => prev + 1);
    setTreeCount(0);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Canvas
        shadows
        camera={{ position: [15, 10, 15], fov: 50 }}
        style={{ background: "linear-gradient(to bottom, #5eb3ff, #87CEEB)" }}
      >
        <OrbitControls
          enablePan={false}
          minDistance={8}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate
          autoRotateSpeed={0.3}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <pointLight position={[-10, 10, -10]} intensity={0.3} color="#fff5ee" />

        <FloatingIsland key={islandKey} ref={islandRef} />

        <fog attach="fog" args={["#87CEEB", 25, 50]} />
      </Canvas>

      {/* Interface utilisateur */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          fontSize: 32,
          fontWeight: "bold",
          textShadow: "3px 3px 6px rgba(0,0,0,0.7)",
          pointerEvents: "none",
        }}
      >
        Île Volante Interactive
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          color: "white",
          fontSize: 14,
          textShadow: "2px 2px 3px rgba(0,0,0,0.7)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleAddTree}
            style={{
              background: "rgba(34, 139, 34, 0.8)",
              border: "none",
              color: "white",
              padding: "12px 24px",
              borderRadius: "25px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.background = "rgba(34, 139, 34, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(34, 139, 34, 0.8)";
            }}
          >
            🌱 Planter un arbre
          </button>

          <button
            onClick={handleRegenerate}
            style={{
              background: "rgba(70, 130, 180, 0.8)",
              border: "none",
              color: "white",
              padding: "12px 24px",
              borderRadius: "25px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.background = "rgba(70, 130, 180, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(70, 130, 180, 0.8)";
            }}
          >
            🏝️ Nouvelle île
          </button>
        </div>

        <div
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            padding: "10px 20px",
            borderRadius: "25px",
            backdropFilter: "blur(10px)",
          }}
        >
          🌳 Arbres plantés: {treeCount}
        </div>
      </div>
    </div>
  );
};

export default ThreePage;
