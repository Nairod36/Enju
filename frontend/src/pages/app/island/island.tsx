import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TreeData } from "./island.types";
import { HexTile, WaterTile, AnimatedTree, Rock } from "./island.components";
import { generateIsland, generateIslandFromShape, enlargeIsland } from "./island.generators.utils";
import { generateIslandShape, enlargeIslandShape } from "./island.generators";

// ===== COMPOSANT ÎLE VOLANTE =====

interface FloatingIslandProps {
  seed: number;
}

export interface FloatingIslandRef {
  addRandomTree: () => void;
  enlargeIsland: () => void;
}

export const FloatingIsland = React.forwardRef<
  FloatingIslandRef,
  FloatingIslandProps
>(({ seed }, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const [animatedTiles, setAnimatedTiles] = useState(0);
  const [showDecorations, setShowDecorations] = useState(false);
  const [userTrees, setUserTrees] = useState<TreeData[]>([]);
  const [usedTiles, setUsedTiles] = useState<Set<string>>(new Set());
  const [isEnlarging, setIsEnlarging] = useState(false);

  // État de l'île (initiale ou agrandie)
  const [islandData, setIslandData] = useState<any>(null);

  // Génération initiale - utiliser le système original COMPLET
  useEffect(() => {
    console.log("🎯 Génération initiale avec relief et biomes");
    const island = generateIsland(seed);
    setIslandData(island);
  }, [seed]);

  // Données actuelles à utiliser
  const currentIslandData = islandData || { landTiles: [], waterTiles: [], rocks: [], totalTiles: 0, waterColor: "#1e88e5" };

  useImperativeHandle(ref, () => ({
    addRandomTree: () => {
      if (!currentIslandData.landTiles || currentIslandData.landTiles.length === 0) {
        console.warn("❌ landTiles non disponibles");
        return;
      }

      const availableTiles = currentIslandData.landTiles.filter(
        (tile) => !usedTiles.has(tile.key)
      );

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
    },
    enlargeIsland: () => {
      if (isEnlarging || !islandData) return;
      
      setIsEnlarging(true);
      console.log("🔍 AGRANDISSEMENT avec relief et biomes...");
      
      // Utiliser l'agrandissement complet qui préserve toutes les features
      const enlargedIsland = enlargeIsland(seed, islandData);
      
      // Mettre à jour l'état
      setIslandData(enlargedIsland);
      
      setTimeout(() => {
        setIsEnlarging(false);
        console.log("✅ Agrandissement terminé avec features complètes");
      }, 200);
    },
  }));

  // Reset seulement au changement de seed
  useEffect(() => {
    setAnimatedTiles(0);
    setShowDecorations(false);
    setUserTrees([]);
    setUsedTiles(new Set());
    setIsEnlarging(false);
  }, [seed]);

  useEffect(() => {
    if (animatedTiles >= currentIslandData.totalTiles * 0.8) {
      setShowDecorations(true);
    }
  }, [animatedTiles, currentIslandData.totalTiles]);

  // Animation de flottement avec variation basée sur la seed
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const time = clock.elapsedTime;
      groupRef.current.position.y = Math.sin(time * 0.2 + seed) * 0.2;
      groupRef.current.rotation.y = time * 0.008 + seed * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Terrain */}
      {currentIslandData.landTiles.map((tile, index) => (
        <HexTile
          key={`land-${tile.key}-${index}`}
          data={tile}
          delay={index * 25}
          onAnimationComplete={() => setAnimatedTiles((prev) => prev + 1)}
        />
      ))}

      {/* Eau */}
      {currentIslandData.waterTiles.map((tile, index) => (
        <WaterTile
          key={`water-${tile.key}-${index}`}
          position={tile.position}
          delay={800 + index * 15}
          color={currentIslandData.waterColor}
        />
      ))}

      {/* Décorations */}
      {showDecorations && (
        <>
          {/* Rochers */}
          {currentIslandData.rocks.map((rock, index) => (
            <Rock
              key={`rock-${index}-${Date.now()}`}
              position={rock.position}
              scale={rock.scale}
              color={rock.color}
              type={rock.type}
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
});
