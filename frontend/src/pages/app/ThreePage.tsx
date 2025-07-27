import React, { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { FloatingIsland, FloatingIslandRef } from "./island/island";
import { generateIslandSeed } from "./island/island.generators";
import { IslandStorageService } from "./island/island.storage";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useIslands } from "../../hooks/useIslands";
import { useAuthContext } from "../../contexts/AuthContext";

// ===== APPLICATION PRINCIPALE =====

const GameContent: React.FC = () => {
  const [treeCount, setTreeCount] = useState(0);
  const [islandSeed, setIslandSeed] = useState(() => generateIslandSeed());
  const islandRef = useRef<FloatingIslandRef>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveIslandName, setSaveIslandName] = useState("");
  const [savedIslands, setSavedIslands] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const { isAuthenticated } = useAuthContext();
  const {
    activeIsland,
    ensureUserHasIsland,
    autoSaveIsland,
    isLoading: islandsLoading,
  } = useIslands();

  // Initialiser l'île de l'utilisateur
  useEffect(() => {
    const initializeUserIsland = async () => {
      if (isAuthenticated && !isInitialized && !islandsLoading) {
        try {
          const userIsland = await ensureUserHasIsland();
          if (userIsland) {
            setIslandSeed(parseInt(userIsland.seed));
            setTreeCount(userIsland.treeCount || 0);
            
            // Charger l'état complet de l'île après que l'île soit rendue
            setTimeout(() => {
              if (islandRef.current) {
                islandRef.current.loadFromDatabase(userIsland);
              }
            }, 1000); // Délai pour s'assurer que l'île est rendue
            
            setIsInitialized(true);
          }
        } catch (error) {
          console.error("Failed to initialize user island:", error);
        }
      }
    };

    initializeUserIsland();
  }, [isAuthenticated, isInitialized, islandsLoading]); // Retiré ensureUserHasIsland des deps

  // Charger les îles sauvegardées
  const loadSavedIslands = async () => {
    try {
      const islands = await IslandStorageService.getAllSavedIslands();
      setSavedIslands(islands);
    } catch (error) {
      console.error("Error loading islands:", error);
    }
  };

  // Fonction pour ajouter un arbre aléatoire
  const handleAddTree = () => {
    if (islandRef.current) {
      islandRef.current.addRandomTree();
      setTreeCount((prev) => prev + 1);
    }
  };

  // Fonction pour régénérer l'île
  const handleRegenerate = () => {
    setIslandSeed(generateIslandSeed());
    setTreeCount(0);
  };

  // Fonction pour agrandir l'île
  const handleEnlargeIsland = () => {
    if (islandRef.current) {
      islandRef.current.enlargeIsland();
    }
  };

  // Fonction pour faire apparaître un coffre
  const handleSpawnChest = () => {
    if (islandRef.current) {
      islandRef.current.spawnChest();
    }
  };

  // Fonction pour sauvegarder l'île
  const handleSaveIsland = async () => {
    if (islandRef.current) {
      const name =
        saveIslandName.trim() || `Île ${new Date().toLocaleDateString()}`;
      try {
        const savedId = await islandRef.current.saveIsland(name);
        if (savedId) {
          alert(`✅ Île "${name}" sauvegardée avec succès !`);
          setShowSaveDialog(false);
          setSaveIslandName("");
        } else {
          alert("❌ Erreur lors de la sauvegarde");
        }
      } catch (error) {
        console.error("Save error:", error);
        alert("❌ Erreur lors de la sauvegarde");
      }
    }
  };

  // Fonction pour sauvegarder l'île actuelle vers l'API
  const handleSaveToAPI = async () => {
    if (!activeIsland || !islandRef.current) {
      alert("❌ Aucune île active à sauvegarder");
      return;
    }

    try {
      const currentState = islandRef.current.getCurrentState();
      
      const updateData = {
        islandData: currentState.islandData,
        treeCount: currentState.treeCount,
        userTrees: currentState.userTrees,
        chests: currentState.chests,
        usedTiles: currentState.usedTiles,
        totalTrees: currentState.treeCount,
        healthScore: 100 // À calculer selon votre logique
      };

      const savedIsland = await autoSaveIsland(activeIsland.id, updateData);
      
      if (savedIsland) {
        alert("✅ Île sauvegardée avec succès !");
      } else {
        alert("❌ Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Save to API error:", error);
      alert("❌ Erreur lors de la sauvegarde en ligne");
    }
  };

  // Fonction pour charger une île
  const handleLoadIsland = (id: string) => {
    if (islandRef.current) {
      const success = islandRef.current.loadIsland(id);
      if (success) {
        const state = islandRef.current.getCurrentState();
        setIslandSeed(state.seed);
        setTreeCount(state.treeCount);
        setShowLoadDialog(false);
        alert("✅ Île chargée avec succès !");
      } else {
        alert("❌ Erreur lors du chargement");
      }
    }
  };

  // Afficher un écran de chargement si l'île n'est pas encore initialisée
  if (islandsLoading || !isInitialized) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          color: "white",
          fontSize: "20px",
          fontWeight: "bold",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid rgba(255,255,255,0.3)",
              borderTop: "4px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          Chargement de votre île...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Canvas shadows camera={{ position: [25, 15, 25], fov: 60 }}>
        <OrbitControls
          enablePan={true}
          minDistance={5}
          maxDistance={100}
          maxPolarAngle={Math.PI}
          autoRotate={false}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[15, 20, 8]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={80}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <pointLight position={[-15, 15, -15]} intensity={0.3} color="#fff5ee" />

        <FloatingIsland seed={islandSeed} ref={islandRef} />

        <fog attach="fog" args={["#87CEEB", 40, 80]} />
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
        Île Volante Procédurale
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
          {/* 
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
          </button> */}

          <button
            onClick={handleEnlargeIsland}
            style={{
              background: "rgba(255, 165, 0, 0.8)",
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
              e.currentTarget.style.background = "rgba(255, 165, 0, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(255, 165, 0, 0.8)";
            }}
          >
            🔍 Agrandir l'île
          </button>

          <button
            onClick={handleSpawnChest}
            style={{
              background: "rgba(184, 134, 11, 0.8)",
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
              e.currentTarget.style.background = "rgba(184, 134, 11, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(184, 134, 11, 0.8)";
            }}
          >
            💰 Ajouter coffre
          </button>

          <button
            onClick={handleSaveToAPI}
            style={{
              background: "rgba(34, 197, 94, 0.8)",
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
              e.currentTarget.style.background = "rgba(34, 197, 94, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(34, 197, 94, 0.8)";
            }}
          >
            💾 Sauvegarder
          </button>

          {/* <button
            onClick={() => setShowSaveDialog(true)}
            style={{
              background: "rgba(34, 197, 94, 0.8)",
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
              e.currentTarget.style.background = "rgba(34, 197, 94, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(34, 197, 94, 0.8)";
            }}
          >
            💾 Sauvegarder
          </button>

          <button
            onClick={() => {
              setShowLoadDialog(true);
              loadSavedIslands();
            }}
            style={{
              background: "rgba(168, 85, 247, 0.8)",
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
              e.currentTarget.style.background = "rgba(168, 85, 247, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(168, 85, 247, 0.8)";
            }}
          >
            📂 Charger
          </button> */}
        </div>

        <div
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            padding: "10px 20px",
            borderRadius: "25px",
            backdropFilter: "blur(10px)",
          }}
        >
          🌳 Arbres plantés: {treeCount} | 🎲 Seed: {Math.floor(islandSeed)}
        </div>
      </div>

      {/* Modal de sauvegarde */}
      {showSaveDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              padding: "30px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              minWidth: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", color: "#333" }}>
              💾 Sauvegarder l'île
            </h2>
            <input
              type="text"
              placeholder="Nom de l'île (optionnel)"
              value={saveIslandName}
              onChange={(e) => setSaveIslandName(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #ddd",
                borderRadius: "10px",
                fontSize: "16px",
                marginBottom: "20px",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowSaveDialog(false)}
                style={{
                  padding: "10px 20px",
                  background: "#ccc",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveIsland}
                style={{
                  padding: "10px 20px",
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de chargement */}
      {showLoadDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowLoadDialog(false)}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              padding: "30px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              minWidth: "500px",
              maxHeight: "70vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", color: "#333" }}>
              📂 Charger une île
            </h2>
            <div style={{ maxHeight: "400px", overflow: "auto" }}>
              {savedIslands.map((island) => (
                <div
                  key={island.id}
                  style={{
                    border: "2px solid #ddd",
                    borderRadius: "10px",
                    padding: "15px",
                    marginBottom: "10px",
                    background: "rgba(255, 255, 255, 0.8)",
                    cursor: "pointer",
                  }}
                  onClick={() => handleLoadIsland(island.id)}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      fontSize: "18px",
                      color: "#333",
                    }}
                  >
                    {island.name}
                  </div>
                  <div
                    style={{
                      color: "#666",
                      fontSize: "14px",
                      marginTop: "5px",
                    }}
                  >
                    🎲 Seed: {island.seed} | 🌳 Arbres: {island.treeCount} | 💰
                    Coffres: {island.chests.length}
                  </div>
                  <div
                    style={{
                      color: "#888",
                      fontSize: "12px",
                      marginTop: "5px",
                    }}
                  >
                    Créée: {new Date(island.createdAt).toLocaleDateString()} |
                    Modifiée:{" "}
                    {new Date(island.lastModified).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {savedIslands.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#666",
                    padding: "20px",
                  }}
                >
                  Aucune île sauvegardée
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setShowLoadDialog(false)}
                style={{
                  padding: "10px 20px",
                  background: "#ccc",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ThreePage: React.FC = () => {
  return (
    <ProtectedRoute>
      <GameContent />
    </ProtectedRoute>
  );
};

export default ThreePage;
