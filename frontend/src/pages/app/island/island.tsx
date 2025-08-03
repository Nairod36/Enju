import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TreeData, CharacterData, ChestData } from "./island.types";
import {
  HexTile,
  WaterTile,
  AnimatedTree,
  Rock,
  House,
  Chest,
} from "./island.components";
import { generateIsland, enlargeIsland } from "./island.generators.utils";
import { IslandStorageService } from "./island.storage";

// ===== COMPOSANT ÎLE VOLANTE =====

interface FloatingIslandProps {
  seed: number;
  initialTreeCount?: number;
  preloadedIslandData?: any; // Preloaded island data from database
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
>(({ seed, initialTreeCount = 0, preloadedIslandData }, ref) => {
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
  const [isLoadedFromDB, setIsLoadedFromDB] = useState(false);

  // État de l'île (initiale ou agrandie)
  const [islandData, setIslandData] = useState<any>(null);

  // Fonction helper pour créer les arbres manquants
  const createMissingTrees = (count: number) => {
    console.log(
      `🔧 createMissingTrees appelée pour créer ${count} arbres, arbres actuels: ${userTrees.length}`
    );
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!islandData?.landTiles || islandData.landTiles.length === 0) {
          return;
        }

        // Obtenir les tuiles utilisées actuelles + positions des maisons
        setUsedTiles((currentUsedTiles) => {
          // Calculer les positions occupées par les maisons
          const houseOccupiedTiles = new Set<string>();
          if (islandData.houses) {
            islandData.houses.forEach((house: any) => {
              // Trouver la tuile la plus proche de la maison
              const closestTile = islandData.landTiles.reduce(
                (closest: any, tile: any) => {
                  const houseDist = Math.sqrt(
                    Math.pow(house.position[0] - tile.position[0], 2) +
                      Math.pow(house.position[2] - tile.position[2], 2)
                  );
                  const closestDist = Math.sqrt(
                    Math.pow(house.position[0] - closest.position[0], 2) +
                      Math.pow(house.position[2] - closest.position[2], 2)
                  );
                  return houseDist < closestDist ? tile : closest;
                }
              );
              houseOccupiedTiles.add(closestTile.key);
            });
          }

          const availableTiles = islandData.landTiles.filter(
            (tile: any) =>
              !currentUsedTiles.has(tile.key) &&
              !houseOccupiedTiles.has(tile.key) &&
              tile.height > 0.5
          );

          if (availableTiles.length === 0) {
            return currentUsedTiles;
          }

          const tile =
            availableTiles[Math.floor(Math.random() * availableTiles.length)];

          const newTree: TreeData = {
            id: `missing-tree-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}-${i}`,
            position: [
              tile.position[0] + (Math.random() - 0.5) * 0.3,
              tile.position[1] + tile.height / 2,
              tile.position[2] + (Math.random() - 0.5) * 0.3,
            ],
            scale: 0.6 + Math.random() * 0.4,
            birthTime: Date.now() - 1000 * 60 * 60 * 24, // Arbre "mature"
          };

          setUserTrees((prev) => [...prev, newTree]);
          setTreeCount((prev) => prev + 1); // Synchroniser le compteur
          return new Set(currentUsedTiles).add(tile.key);
        });
      }, i * 300); // Délai entre chaque arbre
    }
  };

  // Génération initiale - utiliser le système original COMPLET
  useEffect(() => {
    console.log(
      "🔄 Generating island with seed:",
      seed,
      "preloadedIslandData:",
      !!preloadedIslandData
    );

    // Validate preloaded data - it should have landTiles and waterTiles
    const isValidPreloadedData =
      preloadedIslandData &&
      preloadedIslandData.landTiles &&
      preloadedIslandData.landTiles.length > 0;

    console.log("🔍 Is preloaded data valid?", isValidPreloadedData);

    // Use preloaded island data if valid, otherwise generate new
    const island = isValidPreloadedData
      ? preloadedIslandData
      : generateIsland(seed);
    console.log(
      "🏝️ Using island data from:",
      isValidPreloadedData ? "database" : "generator"
    );
    console.log("🏝️ Final island data:", island);
    console.log("🏝️ Island landTiles length:", island?.landTiles?.length || 0);
    console.log(
      "🏝️ Island waterTiles length:",
      island?.waterTiles?.length || 0
    );
    setIslandData(island);

    // Créer le personnage GenericMale au centre de l'île
    if (island.landTiles.length > 0) {
      const centerTile =
        island.landTiles[Math.floor(island.landTiles.length / 2)];
      const characterData: CharacterData = {
        id: `character-${Date.now()}`,
        position: [
          0, // Position au centre de l'île
          centerTile.position[1] + centerTile.height / 2 + 0.5, // Juste au-dessus du terrain
          0,
        ],
        speed: 1.5,
        direction: 0,
        state: "idle",
        lastPositionUpdate: Date.now(),
      };
      setCharacter(characterData);
    }
  }, [seed, preloadedIslandData]);

  // Génération automatique des arbres après la création de l'île (seulement pour les nouvelles îles)
  useEffect(() => {
    if (
      islandData &&
      initialTreeCount > 0 &&
      userTrees.length === 0 &&
      !isLoadedFromDB
    ) {
      console.log(
        `🆕 Nouvelle île détectée (pas de DB), création de ${initialTreeCount} arbres initiaux`
      );
      // Attendre un peu que l'île soit bien initialisée
      setTimeout(() => {
        createMissingTrees(initialTreeCount);
      }, 100);
    } else if (isLoadedFromDB) {
      console.log(
        `📀 Île chargée depuis DB, ignorer la création d'arbres initiaux`
      );
    }
  }, [islandData, initialTreeCount, userTrees.length, isLoadedFromDB]);

  // Données actuelles à utiliser
  const currentIslandData = islandData || {
    landTiles: [],
    waterTiles: [],
    rocks: [],
    houses: [],
    totalTiles: 0,
    waterColor: "#1e88e5",
  };

  useImperativeHandle(ref, () => ({
    addRandomTree: () => {
      console.log(
        `🌱 addRandomTree appelée - arbres actuels: ${userTrees.length}`
      );
      if (
        !currentIslandData.landTiles ||
        currentIslandData.landTiles.length === 0
      ) {
        console.log(`❌ Pas de landTiles disponibles pour planter un arbre`);
        return;
      }

      // Calculer les positions occupées par les maisons
      const houseOccupiedTiles = new Set<string>();
      if (currentIslandData.houses) {
        currentIslandData.houses.forEach((house: any) => {
          // Trouver la tuile la plus proche de la maison
          const closestTile = currentIslandData.landTiles.reduce(
            (closest: any, tile: any) => {
              const houseDist = Math.sqrt(
                Math.pow(house.position[0] - tile.position[0], 2) +
                  Math.pow(house.position[2] - tile.position[2], 2)
              );
              const closestDist = Math.sqrt(
                Math.pow(house.position[0] - closest.position[0], 2) +
                  Math.pow(house.position[2] - closest.position[2], 2)
              );
              return houseDist < closestDist ? tile : closest;
            }
          );
          houseOccupiedTiles.add(closestTile.key);
        });
      }

      const availableTiles = currentIslandData.landTiles.filter(
        (tile) =>
          !usedTiles.has(tile.key) &&
          !houseOccupiedTiles.has(tile.key) &&
          tile.height > 0.5
      );

      if (availableTiles.length === 0) {
        return;
      }

      const tile =
        availableTiles[Math.floor(Math.random() * availableTiles.length)];

      const newTree: TreeData = {
        id: `tree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      // Utiliser l'agrandissement complet qui préserve toutes les features
      const enlargedIsland = enlargeIsland(seed, islandData);

      // Mettre à jour l'état
      setIslandData(enlargedIsland);

      setTimeout(() => {
        setIsEnlarging(false);
      }, 200);
    },
    spawnChest: () => {
      if (
        !currentIslandData.landTiles ||
        currentIslandData.landTiles.length === 0
      ) {
        return;
      }

      // Trouver une tuile libre pour placer le coffre
      const availableTiles = currentIslandData.landTiles.filter(
        (tile) => !usedTiles.has(tile.key) && tile.height > 0.5
      );

      if (availableTiles.length === 0) {
        return;
      }

      const tile =
        availableTiles[Math.floor(Math.random() * availableTiles.length)];

      const newChest: ChestData = {
        id: `chest-${Date.now()}-${Math.random()}`,
        position: [
          tile.position[0],
          tile.position[1] + tile.height / 2 + 0.15,
          tile.position[2],
        ],
        rotation: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.4,
        isOpen: false,
      };

      setChests((prev) => [...prev, newChest]);
      setUsedTiles((prev) => new Set(prev).add(tile.key));
    },
    saveIsland: (customName?: string) => {
      if (!islandData) {
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
        return null;
      }
    },
    loadIsland: (id: string) => {
      try {
        const savedIsland = IslandStorageService.loadIsland(id);
        if (!savedIsland) {
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

        return true;
      } catch (error) {
        return false;
      }
    },
    loadFromDatabase: (dbIsland: any) => {
      try {
        console.log(
          `🗄️ loadFromDatabase appelée pour l'île ${dbIsland.id}, déjà chargée: ${isLoadedFromDB}`
        );

        if (isLoadedFromDB && currentIslandId === dbIsland.id) {
          console.log(`⚠️ Île déjà chargée, ignorer le rechargement`);
          return true;
        }
        // Vérifier si l'île a des données générées
        const hasGeneratedData =
          dbIsland.islandData &&
          dbIsland.islandData.landTiles &&
          dbIsland.islandData.landTiles.length > 0;

        if (hasGeneratedData) {
          // L'île a déjà des données générées, les restaurer
          setIslandData(dbIsland.islandData);
        } else {
          // L'île n'a pas de données générées, garder les données actuelles (générées)
          // Ne pas écraser islandData si elle est déjà générée
        }

        // Restaurer les arbres utilisateur
        const treesToRestore = dbIsland.userTrees || [];
        const totalTreesExpected = dbIsland.totalTrees || 0;

        // Vérifier si les arbres sont valides (pas des tableaux vides)
        const validTrees = treesToRestore.filter(
          (tree) =>
            tree &&
            typeof tree === "object" &&
            tree.id &&
            tree.position &&
            tree.position.length === 3
        );

        if (validTrees.length > 0) {
          console.log(
            `🔄 Chargement de ${validTrees.length} arbres depuis la DB:`,
            validTrees.map((t) => t.id)
          );
          setUserTrees(validTrees);
        } else {
          console.log(
            `🔍 Aucun arbre valide trouvé dans la DB, réinitialisation`
          );
          setUserTrees([]); // Nettoyer les tableaux vides
        }

        // Créer des arbres manquants SEULEMENT si la DB indique qu'il devrait y en avoir
        // mais qu'aucun n'a été trouvé (corruption de données)
        const missingTreesCount = totalTreesExpected - validTrees.length;
        console.log(
          `🌳 Arbres chargés depuis la DB: ${validTrees.length}, totalTrees attendu: ${totalTreesExpected}, manquants: ${missingTreesCount}`
        );

        // Ne jamais créer d'arbres manquants si on charge depuis la DB
        // Les arbres en DB sont la seule source de vérité
        if (
          missingTreesCount > 0 &&
          validTrees.length === 0 &&
          totalTreesExpected > 0
        ) {
          console.log(
            `🔧 Aucun arbre trouvé mais ${totalTreesExpected} attendus, recréation pour corruption de données...`
          );
          setTimeout(() => {
            createMissingTrees(missingTreesCount);
          }, 1000);
        } else if (validTrees.length > 0) {
          console.log(
            `✅ ${validTrees.length} arbres chargés depuis la DB, pas de recréation nécessaire`
          );
        }

        // Restaurer les coffres
        if (dbIsland.chests && dbIsland.chests.length > 0) {
          setChests(dbIsland.chests);
        }

        // Restaurer les tuiles utilisées
        if (dbIsland.usedTiles && dbIsland.usedTiles.length > 0) {
          setUsedTiles(new Set(dbIsland.usedTiles));
        }

        // Le treeCount sera mis à jour automatiquement par les arbres restaurés et manquants
        // Initialiser d'abord avec les arbres valides restaurés
        setTreeCount(validTrees.length);

        // Mettre à jour l'ID de l'île courante et marquer comme chargée
        setCurrentIslandId(dbIsland.id);
        setIsLoadedFromDB(true);

        return true;
      } catch (error) {
        return false;
      }
    },
    getCurrentState: () => ({
      seed,
      islandData,
      userTrees,
      chests,
      usedTiles,
      treeCount,
    }),
  }));

  // Reset seulement au changement de seed
  useEffect(() => {
    console.log(`🔄 Reset de l'île pour le nouveau seed: ${seed}`);
    setAnimatedTiles(0);
    setShowDecorations(false);
    setUserTrees([]);
    setUsedTiles(new Set());
    setIsEnlarging(false);
    setChests([]);
    setCharacter(null);
    setCurrentIslandId(null);
    setTreeCount(0);
    setIsLoadedFromDB(false); // Permettre le rechargement pour le nouveau seed
  }, [seed]);

  useEffect(() => {
    if (animatedTiles >= currentIslandData.totalTiles * 0.8) {
      setShowDecorations(true);
    }
  }, [animatedTiles, currentIslandData.totalTiles]);

  // Calculer les obstacles pour le personnage
  const obstacles = useMemo(() => {
    const obstacleList: Array<{
      position: [number, number, number];
      radius: number;
    }> = [];

    // Ajouter les rochers comme obstacles
    currentIslandData.rocks?.forEach((rock) => {
      obstacleList.push({
        position: rock.position,
        radius: rock.scale * 0.3,
      });
    });

    // Ajouter les maisons comme obstacles
    currentIslandData.houses?.forEach((house) => {
      obstacleList.push({
        position: house.position,
        radius: 0.5,
      });
    });

    // Ajouter les arbres comme obstacles
    userTrees.forEach((tree) => {
      obstacleList.push({
        position: tree.position,
        radius: tree.scale * 0.4,
      });
    });

    // Ajouter les coffres comme obstacles
    chests.forEach((chest) => {
      obstacleList.push({
        position: chest.position,
        radius: chest.scale * 0.3,
      });
    });

    // Ajouter les tuiles d'eau comme obstacles
    currentIslandData.waterTiles?.forEach((waterTile) => {
      obstacleList.push({
        position: waterTile.position,
        radius: 0.6,
      });
    });

    return obstacleList;
  }, [
    currentIslandData.rocks,
    currentIslandData.houses,
    currentIslandData.waterTiles,
    userTrees,
    chests,
  ]);

  // Gestionnaire de mise à jour du personnage
  const handleCharacterUpdate = (updatedCharacter: CharacterData) => {
    setCharacter(updatedCharacter);
  };

  // Gestionnaire de clic sur coffre
  const handleChestClick = (chestId: string) => {
    setChests((prev) =>
      prev.map((chest) =>
        chest.id === chestId ? { ...chest, isOpen: !chest.isOpen } : chest
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
              key={`rock-${index}-${rock.position.join("-")}`}
              position={rock.position}
              scale={rock.scale}
              color={rock.color}
              type={rock.type}
            />
          ))}

          {/* Maisons */}
          {currentIslandData.houses.map((house, index) => (
            <House
              key={`house-${index}-${house.position.join("-")}`}
              position={house.position}
              scale={house.scale}
              rotation={house.rotation}
            />
          ))}
        </>
      )}

      {userTrees
        .filter((tree) => tree && tree.id && tree.position) // Filtrer les arbres valides
        .map((tree) => (
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
        <Chest key={chest.id} chest={chest} onChestClick={handleChestClick} />
      ))}
    </group>
  );
});
