import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland } from "./island/island";
import {
  Search,
  Users,
  TreePine,
  Gem,
  Calendar,
  Crown,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  usePublicIslands,
  PublicIslandData,
} from "../../hooks/usePublicIslands";
import { authService } from "../../services/auth";

// Simple test component to check if Three.js works
function TestCube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

export function IslandExplorer() {
  const { islands, loading, error, refreshIslands } = usePublicIslands();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIsland, setSelectedIsland] = useState<PublicIslandData | null>(
    null
  );

  // Get current user data
  const currentUser = authService.getUserData();
  const currentUserWalletAddress = currentUser?.walletAddress;

  // Debug logs
  console.log("Current user:", currentUser);
  console.log("Current user wallet address:", currentUserWalletAddress);
  console.log("Islands data:", islands);
  console.log("Islands length:", islands.length);
  console.log("Loading state:", loading);
  console.log("Error state:", error);

  // Helper function to check if current user owns the island
  const isMyIsland = (island: PublicIslandData): boolean => {
    const isOwner =
      currentUserWalletAddress &&
      island.owner?.walletAddress === currentUserWalletAddress;
    if (isOwner) {
      console.log(
        "Found my island:",
        island.name,
        "Owner:",
        island.owner?.walletAddress
      );
    }
    return isOwner;
  };

  // Helper function to convert string seed to number (same as AppDashboard)
  const convertSeedToNumber = (seed: string): number => {
    const seedNumber = parseInt(seed);
    console.log(`Seed conversion: "${seed}" -> ${seedNumber}`);
    return seedNumber;
  };

  const filteredIslands = islands.filter(
    (island) =>
      island.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (island.owner?.username || island.owner?.walletAddress || "Unknown")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  console.log("Filtered islands:", filteredIslands);

  return (
    <div className="min-h-screen">
      {/* Header - Following AppDashboard style */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full pr-8 py-4 pl-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Island Explorer
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Discover and explore beautiful islands created by our community
              </p>
            </div>

            {/* Stats in header - AppDashboard style */}
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {islands.length}
                </div>
                <div className="text-xs text-gray-500">Public Islands</div>
              </div>

              <div className="w-px h-8 bg-gray-200"></div>

              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {islands.reduce(
                    (sum, island) => sum + (island.totalTrees || 0),
                    0
                  )}
                </div>
                <div className="text-xs text-gray-500">Total Trees</div>
              </div>

              <div className="w-px h-8 bg-gray-200"></div>

              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {
                    new Set(
                      islands
                        .map((island) => island.owner?.walletAddress)
                        .filter(Boolean)
                    ).size
                  }
                </div>
                <div className="text-xs text-gray-500">Owners</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(85vh-80px)]">
        {/* Left Sidebar - Search and Filters */}
        <div className="w-[30%] bg-white border-r border-gray-200 flex flex-col">
          <div className="pr-8 py-6 pl-20 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Search Islands
            </h3>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search islands or creators..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(e.target.value)
                }
                className="pl-10 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* Island Stats */}
          <div className="bg-white pr-8 py-6 pl-20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Total Islands
                </span>
                <span className="font-mono text-sm font-bold text-gray-900">
                  {islands.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Trees Planted
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {islands.reduce(
                    (sum, island) => sum + (island.totalTrees || 0),
                    0
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Active Owners
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {
                    new Set(
                      islands
                        .map((island) => island.owner?.walletAddress)
                        .filter(Boolean)
                    ).size
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Treasure Chests
                </span>
                <span className="text-sm font-bold text-yellow-600">
                  {islands.reduce(
                    (sum, island) => sum + (island.chests?.length || 0),
                    0
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Islands Grid */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="p-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                    <span className="text-gray-600">Loading islands...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <div className="w-12 h-12 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-red-400" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Error loading islands
                  </h4>
                  <p className="text-xs text-gray-500 mb-4">{error}</p>
                  <Button
                    onClick={refreshIslands}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredIslands.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    No islands found
                  </h4>
                  <p className="text-xs text-gray-500">
                    Try adjusting your search terms to find more islands.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredIslands.map((island) => (
                    <div
                      key={island.id}
                      className="bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-200 hover:border-gray-300 cursor-pointer overflow-hidden"
                      onClick={() => setSelectedIsland(island)}
                    >
                      {/* 3D Island Preview - Bigger */}
                      <div className="h-64 bg-gradient-to-br from-sky-100 to-emerald-50 relative">
                        {/* My Island Badge */}
                        {isMyIsland(island) && (
                          <div className="absolute top-3 right-3 z-10 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5">
                            <Crown className="w-4 h-4" />
                            My Island
                          </div>
                        )}
                        {/* Temporary fallback to test if Canvas works */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center p-4">
                            <div className="text-6xl mb-2">🏝️</div>
                            <div className="text-lg font-bold text-gray-800">
                              {island.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              Seed: {island.seed}
                            </div>
                            <div className="text-xs text-red-500 mt-2">
                              Debug: Canvas should be here
                            </div>
                          </div>
                        </div>
                        <Canvas
                          shadows
                          camera={{ position: [12, 6, 12], fov: 45 }}
                          style={{ opacity: 0.8 }} // Make canvas semi-transparent to see if it renders
                        >
                          <OrbitControls
                            enablePan={false}
                            enableZoom={false}
                            enableRotate={false}
                            autoRotate={true}
                            autoRotateSpeed={0.8}
                          />
                          <ambientLight intensity={0.6} />
                          <directionalLight
                            position={[12, 12, 6]}
                            intensity={0.9}
                            castShadow
                          />
                          {/* Test with simple cube first */}
                          <TestCube />
                          {/* 
                          <FloatingIsland
                            seed={convertSeedToNumber(island.seed)}
                            initialTreeCount={island.totalTrees || 0}
                            preloadedIslandData={island.islandData}
                          />
                          */}
                          <fog attach="fog" args={["#87CEEB", 25, 60]} />
                        </Canvas>
                      </div>

                      <div className="p-6">
                        {/* Owner Info */}
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {island.owner?.username || "Unknown User"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {island.owner?.walletAddress || "No wallet"}
                            </p>
                          </div>
                        </div>

                        {/* Island Stats - Bigger */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg p-3">
                            <TreePine className="w-5 h-5 text-emerald-600" />
                            <div>
                              <div className="text-lg font-bold text-emerald-700">
                                {island.totalTrees || 0}
                              </div>
                              <div className="text-xs text-emerald-600">
                                Trees
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 bg-yellow-50 rounded-lg p-3">
                            <Gem className="w-5 h-5 text-yellow-600" />
                            <div>
                              <div className="text-lg font-bold text-yellow-700">
                                {island.chests?.length || 0}
                              </div>
                              <div className="text-xs text-yellow-600">
                                Chests
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Last Updated */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Updated{" "}
                              {new Date(
                                island.lastModified
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-indigo-600">
                            #{island.seed}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Island Detail Modal - AppDashboard style */}
      {selectedIsland && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedIsland(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - AppDashboard style */}
            <div className="bg-white border-b border-gray-200">
              <div className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Island Details
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                      Owned by{" "}
                      {selectedIsland.owner?.username ||
                        selectedIsland.owner?.walletAddress ||
                        "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* My Island Badge */}
                    {isMyIsland(selectedIsland) && (
                      <div className="flex items-center bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200">
                        <Crown className="w-3 h-3 mr-1.5" />
                        My Island
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIsland(null)}
                      className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400 rotate-45" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-[calc(80vh-120px)]">
              {/* Left Side - 3D Island View */}
              <div className="w-[70%] bg-gradient-to-br from-sky-50 to-emerald-50">
                <Canvas shadows camera={{ position: [15, 8, 15], fov: 60 }}>
                  <OrbitControls
                    enablePan={true}
                    minDistance={5}
                    maxDistance={30}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                  />
                  <ambientLight intensity={0.4} />
                  <directionalLight
                    position={[15, 20, 8]}
                    intensity={1.2}
                    castShadow
                  />
                  <FloatingIsland
                    seed={convertSeedToNumber(selectedIsland.seed)}
                    initialTreeCount={selectedIsland.totalTrees || 0}
                    preloadedIslandData={selectedIsland.islandData}
                  />
                  <fog attach="fog" args={["#87CEEB", 30, 60]} />
                </Canvas>
              </div>

              {/* Right Side - Island Details */}
              <div className="w-[30%] bg-white border-l border-gray-200 flex flex-col">
                {/* Island Stats */}
                <div className="bg-gray-50 border-b border-gray-200 p-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">
                    Island Properties
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Island Seed
                      </span>
                      <span className="font-mono text-sm font-bold text-gray-900">
                        #{selectedIsland.seed}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Trees Planted
                      </span>
                      <span className="text-sm font-bold text-emerald-600">
                        {selectedIsland.totalTrees || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Treasure Chests
                      </span>
                      <span className="text-sm font-bold text-yellow-600">
                        {selectedIsland.chests?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Created
                      </span>
                      <span className="text-sm text-gray-900">
                        {new Date(selectedIsland.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Island Features */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">
                    Island Features
                  </h3>
                  <div className="space-y-3">
                    {/* Trees */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                          <TreePine className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">
                            {selectedIsland.totalTrees || 0} Trees
                          </div>
                          <div className="text-xs text-gray-500">
                            Planted and growing
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Treasures */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                          <Gem className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">
                            {selectedIsland.chests?.length || 0} Treasures
                          </div>
                          <div className="text-xs text-gray-500">
                            Hidden rewards
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6">
                    <Button
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl"
                      onClick={() => {
                        console.log("Favoriting island:", selectedIsland.id);
                      }}
                    >
                      💚 Like This Island
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
