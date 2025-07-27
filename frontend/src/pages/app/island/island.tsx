import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TreeData, CharacterData, ChestData, SavedIslandState } from "./island.types";
import { HexTile, WaterTile, AnimatedTree, Rock, House, GenericMale, Chest } from "./island.components";
import { generateIsland, generateIslandFromShape, enlargeIsland } from "./island.generators.utils";
import { generateIslandShape, enlargeIslandShape } from "./island.generators";
import { IslandStorageService } from "./island.storage";

// ===== COMPOSANT ÎLE VOLANTE =====

interface FloatingIslandProps {
  seed: number;
}

export interface FloatingIslandRef {
  addRandomTree: () => void;
  enlargeIsland: () => void;
  spawnChest: () => void;
  saveIsland: (customName?: string) => string | null;
  loadIsland: (id: string) => boolean;
  loadFromDatabase: (islandData: any) => boolean;
  getCurrentState: () => {
    seed: number;
    islandData: any;
    userTrees: TreeData[];
    chests: ChestData[];
    usedTiles: Set<string>;
    treeCount: number;
  };
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
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [chests, setChests] = useState<ChestData[]>([]);
  const [currentIslandId, setCurrentIslandId] = useState<string | null>(null);
  const [treeCount, setTreeCount] = useState(0);

  // État de l'île (initiale ou agrandie)
  const [islandData, setIslandData] = useState<any>(null);

  // Génération initiale - utiliser le système original COMPLET
  useEffect(() => {
    console.log("🎯 Génération initiale avec relief et biomes");
    const island = generateIsland(seed);
    setIslandData(island);

    // Créer le personnage GenericMale au centre de l'île
    if (island.landTiles.length > 0) {
      const centerTile = island.landTiles[Math.floor(island.landTiles.length / 2)];
      const characterData: CharacterData = {
        id: `character-${Date.now()}`,
        position: [
          0, // Position au centre de l'île
          centerTile.position[1] + centerTile.height / 2 + 0.5, // Juste au-dessus du terrain
          0
        ],
        speed: 1.5,
        direction: 0,
        state: 'idle',
        lastPositionUpdate: Date.now()
      };
      console.log("🧑 Personnage créé à la position:", characterData.position);
      setCharacter(characterData);
    }
  }, [seed]);

  // Données actuelles à utiliser
  const currentIslandData = islandData || { landTiles: [], waterTiles: [], rocks: [], houses: [], totalTiles: 0, waterColor: "#1e88e5" };

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
      setTreeCount((prev) => prev + 1);
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
    spawnChest: () => {
      if (!currentIslandData.landTiles || currentIslandData.landTiles.length === 0) {
        console.warn("❌ Impossible de placer un coffre, pas de tuiles terrestres");
        return;
      }

      // Trouver une tuile libre pour placer le coffre
      const availableTiles = currentIslandData.landTiles.filter(
        (tile) => !usedTiles.has(tile.key) && tile.height > 0.5
      );

      if (availableTiles.length === 0) {
        console.warn("❌ Plus de tuiles disponibles pour placer un coffre");
        return;
      }

      const tile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
      
      const newChest: ChestData = {
        id: `chest-${Date.now()}-${Math.random()}`,
        position: [
          tile.position[0],
          tile.position[1] + tile.height / 2 + 0.15,
          tile.position[2]
        ],
        rotation: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.4,
        isOpen: false
      };

      setChests(prev => [...prev, newChest]);
      setUsedTiles(prev => new Set(prev).add(tile.key));
    },
    saveIsland: (customName?: string) => {
      if (!islandData) {
        console.warn("❌ Aucune île à sauvegarder");
        return null;
      }

      try {
        const id = IslandStorageService.saveIsland(
          seed,
          islandData,
          userTrees,
          chests,
          usedTiles,
          treeCount,
          customName
        );
        setCurrentIslandId(id);
        return id;
      } catch (error) {
        console.error("❌ Erreur lors de la sauvegarde:", error);
        return null;
      }
    },
    loadIsland: (id: string) => {
      try {
        const savedIsland = IslandStorageService.loadIsland(id);
        if (!savedIsland) {
          console.warn("❌ Île non trouvée");
          return false;
        }

        // Restaurer l'état complet
        setIslandData(savedIsland.baseIslandData);
        setUserTrees(savedIsland.userTrees);
        setChests(savedIsland.chests);
        setUsedTiles(new Set(savedIsland.usedTiles));
        setTreeCount(savedIsland.treeCount);
        setCurrentIslandId(id);
        
        // Réinitialiser les animations
        setAnimatedTiles(0);
        setShowDecorations(false);
        setIsEnlarging(false);
        setCharacter(null);

        console.log(`✅ Île "${savedIsland.name}" chargée avec succès`);
        return true;
      } catch (error) {
        console.error("❌ Erreur lors du chargement:", error);
        return false;
      }
    },
    loadFromDatabase: (dbIsland: any) => {
      try {
        console.log("🔄 Chargement de l'île depuis la base de données...", dbIsland);
        
        // Restaurer les données de l'île depuis la base
        if (dbIsland.islandData) {
          setIslandData(dbIsland.islandData);
        }
        
        // Restaurer les arbres utilisateur
        if (dbIsland.userTrees && dbIsland.userTrees.length > 0) {
          setUserTrees(dbIsland.userTrees);
          console.log(`✅ ${dbIsland.userTrees.length} arbres restaurés`);
        }
        
        // Restaurer les coffres
        if (dbIsland.chests && dbIsland.chests.length > 0) {
          setChests(dbIsland.chests);
          console.log(`✅ ${dbIsland.chests.length} coffres restaurés`);
        }
        
        // Restaurer les tuiles utilisées
        if (dbIsland.usedTiles && dbIsland.usedTiles.length > 0) {
          setUsedTiles(new Set(dbIsland.usedTiles));
          console.log(`✅ ${dbIsland.usedTiles.length} tuiles utilisées restaurées`);
        }
        
        // Restaurer le nombre d'arbres
        if (dbIsland.treeCount !== undefined) {
          setTreeCount(dbIsland.treeCount);
        }
        
        // Mettre à jour l'ID de l'île courante
        setCurrentIslandId(dbIsland.id);
        
        console.log(`✅ Île "${dbIsland.name}" chargée depuis la base de données`);
        return true;
      } catch (error) {
        console.error("❌ Erreur lors du chargement depuis la base:", error);
        return false;
      }
    },
    getCurrentState: () => ({
      seed,
      islandData,
      userTrees,
      chests,
      usedTiles,
      treeCount
    })
  }));

  // Reset seulement au changement de seed
  useEffect(() => {
    setAnimatedTiles(0);
    setShowDecorations(false);
    setUserTrees([]);
    setUsedTiles(new Set());
    setIsEnlarging(false);
    setChests([]);
    setCharacter(null);
    setCurrentIslandId(null);
    setTreeCount(0);
  }, [seed]);

  useEffect(() => {
    if (animatedTiles >= currentIslandData.totalTiles * 0.8) {
      setShowDecorations(true);
    }
  }, [animatedTiles, currentIslandData.totalTiles]);

  // Calculer les obstacles pour le personnage
  const obstacles = useMemo(() => {
    const obstacleList: Array<{ position: [number, number, number]; radius: number }> = [];
    
    // Ajouter les rochers comme obstacles
    currentIslandData.rocks?.forEach(rock => {
      obstacleList.push({
        position: rock.position,
        radius: rock.scale * 0.3
      });
    });
    
    // Ajouter les maisons comme obstacles
    currentIslandData.houses?.forEach(house => {
      obstacleList.push({
        position: house.position,
        radius: 0.5
      });
    });
    
    // Ajouter les arbres comme obstacles
    userTrees.forEach(tree => {
      obstacleList.push({
        position: tree.position,
        radius: tree.scale * 0.4
      });
    });
    
    // Ajouter les coffres comme obstacles
    chests.forEach(chest => {
      obstacleList.push({
        position: chest.position,
        radius: chest.scale * 0.3
      });
    });
    
    // Ajouter les tuiles d'eau comme obstacles
    currentIslandData.waterTiles?.forEach(waterTile => {
      obstacleList.push({
        position: waterTile.position,
        radius: 0.6
      });
    });
    
    return obstacleList;
  }, [currentIslandData.rocks, currentIslandData.houses, currentIslandData.waterTiles, userTrees, chests]);

  // Gestionnaire de mise à jour du personnage
  const handleCharacterUpdate = (updatedCharacter: CharacterData) => {
    setCharacter(updatedCharacter);
  };

  // Gestionnaire de clic sur coffre
  const handleChestClick = (chestId: string) => {
    setChests(prev => 
      prev.map(chest => 
        chest.id === chestId 
          ? { ...chest, isOpen: !chest.isOpen }
          : chest
      )
    );
  };

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

          {/* Maisons */}
          {currentIslandData.houses.map((house, index) => (
            <House
              key={`house-${index}-${Date.now()}`}
              position={house.position}
              scale={house.scale}
              rotation={house.rotation}
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


      {/* Coffres */}
      {chests.map((chest) => (
        <Chest
          key={chest.id}
          chest={chest}
          onChestClick={handleChestClick}
        />
      ))}
    </group>
  );
});
