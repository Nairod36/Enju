import { useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland } from "./island/island";
import { Search, Users, TreePine, Gem, Calendar, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePublicIslands, PublicIslandData } from "../../hooks/usePublicIslands";
import { authService } from "../../services/auth";

export function IslandExplorer() {
  const { islands, loading, error, refreshIslands } = usePublicIslands();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIsland, setSelectedIsland] = useState<PublicIslandData | null>(null);

  // Get current user data
  const currentUser = authService.getUserData();
  const currentUserWalletAddress = currentUser?.walletAddress;

  // Debug logs
  console.log('Current user:', currentUser);
  console.log('Current user wallet address:', currentUserWalletAddress);

  // Helper function to check if current user owns the island
  const isMyIsland = (island: PublicIslandData): boolean => {
    const isOwner = currentUserWalletAddress && island.owner?.walletAddress === currentUserWalletAddress;
    if (isOwner) {
      console.log('Found my island:', island.name, 'Owner:', island.owner?.walletAddress);
    }
    return isOwner;
  };

  // Helper function to convert string seed to number (same as AppDashboard)
  const convertSeedToNumber = (seed: string): number => {
    const seedNumber = parseInt(seed);
    console.log(`Seed conversion: "${seed}" -> ${seedNumber}`);
    return seedNumber;
  };

  const filteredIslands = islands.filter(island =>
    island.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (island.owner?.username || island.owner?.walletAddress || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-normal text-slate-900 mb-2">
            Island Explorer
          </h1>
          <p className="text-slate-600 text-lg">
            Discover and explore beautiful islands created by our community
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search islands or creators..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full border-slate-200 focus:border-emerald-300 focus:ring-emerald-200"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <div className="text-2xl font-semibold text-emerald-600">{islands.length}</div>
            <div className="text-sm text-slate-500">Public Islands</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-emerald-600">
              {islands.reduce((sum, island) => sum + (island.totalTrees || 0), 0)}
            </div>
            <div className="text-sm text-slate-500">Total Trees</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-emerald-600">
              {new Set(islands.map(island => island.owner?.walletAddress).filter(Boolean)).size}
            </div>
            <div className="text-sm text-slate-500">Owners</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <div className="text-red-500 mb-4">
            <div className="text-xl font-medium">Error loading islands</div>
            <div className="text-sm">{error}</div>
          </div>
          <Button 
            onClick={refreshIslands} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIslands.map((island) => (
            <Card
              key={island.id}
              className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-slate-200 bg-white/80 backdrop-blur-sm"
              onClick={() => setSelectedIsland(island)}
            >
              {/* 3D Island Preview */}
              <div className="h-64 bg-gradient-to-br from-sky-100 to-emerald-50 relative">
                {/* My Island Badge */}
                {isMyIsland(island) && (
                  <div className="absolute top-2 right-2 z-10 bg-emerald-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    My Island
                  </div>
                )}
                <Canvas
                  shadows
                  camera={{ position: [10, 5, 10], fov: 50 }}
                >
                  <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    enableRotate={false}
                    autoRotate={true}
                    autoRotateSpeed={1}
                  />
                  <ambientLight intensity={0.6} />
                  <directionalLight
                    position={[10, 10, 5]}
                    intensity={0.8}
                    castShadow
                  />
                  <FloatingIsland 
                    seed={convertSeedToNumber(island.seed)} 
                    initialTreeCount={island.totalTrees || 0}
                    preloadedIslandData={island.islandData}
                  />
                  <fog attach="fog" args={["#87CEEB", 20, 50]} />
                </Canvas>
              </div>

              <CardContent className="p-4">
                {/* Owner Info */}
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Owned by <span className="font-medium text-slate-900">{island.owner?.username || island.owner?.walletAddress || 'Unknown'}</span>
                  </span>
                </div>

                {/* Island Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <TreePine className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm">
                      <span className="font-medium">{island.totalTrees || 0}</span> trees
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gem className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">
                      <span className="font-medium">{island.chests?.length || 0}</span> chests
                    </span>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>Updated {new Date(island.lastModified).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredIslands.length === 0 && !loading && !error && (
        <div className="text-center py-20">
          <div className="text-slate-400 mb-4">
            <Search className="w-12 h-12 mx-auto mb-4" />
          </div>
          <h3 className="text-xl font-medium text-slate-600 mb-2">
            No islands found
          </h3>
          <p className="text-slate-500">
            Try adjusting your search terms to find more islands.
          </p>
        </div>
      )}

      {/* Island Detail Modal */}
      {selectedIsland && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedIsland(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-slate-600">
                      Island owned by {selectedIsland.owner?.username || selectedIsland.owner?.walletAddress || 'Unknown'}
                    </p>
                  </div>
                  {/* My Island Badge in Modal */}
                  {isMyIsland(selectedIsland) && (
                    <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Crown className="w-4 h-4" />
                      My Island
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIsland(null)}
                  className="rounded-full"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* 3D View */}
            <div className="h-96 bg-gradient-to-br from-sky-100 to-emerald-50">
              <Canvas
                shadows
                camera={{ position: [15, 8, 15], fov: 60 }}
              >
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

            {/* Details */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <TreePine className="w-5 h-5 text-emerald-500" />
                    <div>
                      <div className="font-medium">{selectedIsland.totalTrees || 0} Trees</div>
                      <div className="text-sm text-slate-500">Planted and growing</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Gem className="w-5 h-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">{selectedIsland.chests?.length || 0} Treasure Chests</div>
                      <div className="text-sm text-slate-500">Hidden rewards</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600 mb-1">Island Seed</div>
                    <div className="font-mono text-sm bg-slate-100 px-3 py-2 rounded-lg">
                      {selectedIsland.seed}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-600 mb-1">Created</div>
                    <div className="text-sm">
                      {new Date(selectedIsland.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 px-6 border-slate-200 hover:bg-slate-50"
                  onClick={() => {
                    // Handle favorite
                    console.log("Favoriting island:", selectedIsland.id);
                  }}
                >
                  💚 Like
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
