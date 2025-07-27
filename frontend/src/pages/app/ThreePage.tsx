import React, { useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland, FloatingIslandRef } from "./island/island";
import { generateIslandSeed } from "./island/island.generators";

// ===== APPLICATION PRINCIPALE =====

export const ThreePage: React.FC = () => {
  const [treeCount, setTreeCount] = useState(0);
  const [islandSeed, setIslandSeed] = useState(() => generateIslandSeed());
  const islandRef = useRef<FloatingIslandRef>(null);

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
    </div>
  );
};

export default ThreePage;
