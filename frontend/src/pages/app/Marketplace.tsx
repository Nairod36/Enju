import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Heart,
  Zap,
  Crown,
  Gem,
  TrendingUp,
  Clock,
  User,
  Coins,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMarketplace, type AnimalNFT } from "../../hooks/useMarketplace";

const rarityColors = {
  COMMON: "bg-gray-100 text-gray-800 border-gray-200",
  UNCOMMON: "bg-green-100 text-green-800 border-green-200", 
  RARE: "bg-blue-100 text-blue-800 border-blue-200",
  EPIC: "bg-purple-100 text-purple-800 border-purple-200",
  LEGENDARY: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

const rarityIcons = {
  COMMON: "⚪",
  UNCOMMON: "🟢", 
  RARE: "🔵",
  EPIC: "🟣",
  LEGENDARY: "🟡"
};

export function Marketplace() {
  const { nfts, loading, error, buyNFT, placeBid, refreshMarketplace } = useMarketplace();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showOnlyAuctions, setShowOnlyAuctions] = useState(false);

  // Filtrer et trier les NFT
  const filteredNFTs = nfts
    .filter(nft => {
      const matchesSearch = nft.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           nft.animalTypeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           nft.seller.username?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = selectedRarity === "ALL" || nft.rarity === selectedRarity;
      const matchesAuction = !showOnlyAuctions || nft.isAuction;
      return matchesSearch && matchesRarity && matchesAuction && nft.listed;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-high":
          return parseFloat(b.price) - parseFloat(a.price);
        case "level":
          return b.level - a.level;
        case "rarity":
          const rarityOrder = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
          return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        case "newest":
        default:
          return b.listedAt - a.listedAt;
      }
    });

  const formatTimeRemaining = (endTime: number) => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) return "Auction ended";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full pr-8 py-6 pl-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">NFT Marketplace</h1>
              <p className="text-sm text-gray-500 mt-1">
                Discover, collect, and trade unique animal NFTs
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : nfts.filter(n => n.listed).length}
                </div>
                <div className="text-xs text-gray-500">Listed NFTs</div>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : nfts.filter(n => n.isAuction && n.listed).length}
                </div>
                <div className="text-xs text-gray-500">Active Auctions</div>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : new Set(nfts.filter(n => n.listed).map(n => n.seller.address)).size}
                </div>
                <div className="text-xs text-gray-500">Sellers</div>
              </div>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshMarketplace}
                disabled={loading}
                className="ml-4"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0">
        {/* Sidebar - Filters */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col min-h-0">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters & Search</h3>
            
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search animals, names, sellers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
              />
            </div>

            {/* View Mode */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">View</label>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="flex-1"
                >
                  <Grid3X3 className="w-4 h-4 mr-1" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="flex-1"
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>
            </div>

            {/* Sort */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:border-indigo-300 focus:ring-indigo-200"
              >
                <option value="newest">Newest Listed</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="level">Highest Level</option>
                <option value="rarity">Highest Rarity</option>
              </select>
            </div>

            {/* Rarity Filter */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-3 block">Rarity</label>
              <div className="space-y-2">
                {["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((rarity) => (
                  <div
                    key={rarity}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedRarity === rarity
                        ? "bg-indigo-50 border-indigo-200 border"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                    onClick={() => setSelectedRarity(rarity)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {rarity === "ALL" ? "All Rarities" : rarity}
                      </span>
                      {rarity !== "ALL" && (
                        <span className="text-lg">{rarityIcons[rarity as keyof typeof rarityIcons]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auction Filter */}
            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyAuctions}
                  onChange={(e) => setShowOnlyAuctions(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Show only auctions</span>
              </label>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Results</span>
                <span className="text-sm font-medium">{filteredNFTs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg. Price</span>
                <span className="text-sm font-medium">
                  {filteredNFTs.length > 0
                    ? Math.round(filteredNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0) / filteredNFTs.length)
                    : 0
                  } REWARD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Highest Level</span>
                <span className="text-sm font-medium">
                  {filteredNFTs.length > 0 ? Math.max(...filteredNFTs.map(nft => nft.level)) : 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-50 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-8">
              {loading ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Loading NFTs...</h3>
                  <p className="text-gray-500">Fetching the latest marketplace data.</p>
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading marketplace</h3>
                  <p className="text-gray-500 mb-4">{error}</p>
                  <Button onClick={refreshMarketplace} className="bg-indigo-600 hover:bg-indigo-700">
                    Try Again
                  </Button>
                </div>
              ) : filteredNFTs.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No NFTs found</h3>
                  <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                </div>
              ) : (
                <div className={
                  viewMode === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "space-y-4"
                }>
                  {filteredNFTs.map((nft) => (
                    <Card key={nft.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
                      <CardContent className="p-0">
                        {viewMode === "grid" ? (
                          // Grid View
                          <div className="flex flex-col">
                            {/* Image */}
                            <div className="aspect-square bg-gradient-to-br from-emerald-50 to-blue-50 relative">
                              {nft.isAuction && (
                                <div className="absolute top-3 left-3 z-10">
                                  <Badge className="bg-red-500 text-white">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatTimeRemaining(nft.auctionEndTime!)}
                                  </Badge>
                                </div>
                              )}
                              <div className="absolute top-3 right-3 z-10">
                                <Badge className={`${rarityColors[nft.rarity]} border text-xs font-medium`}>
                                  {rarityIcons[nft.rarity]} {nft.rarity}
                                </Badge>
                              </div>
                              {/* Placeholder pour l'image 3D */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-6xl">
                                  {nft.animalTypeName === "Tiger" ? "🐅" :
                                   nft.animalTypeName === "Fox" ? "🦊" :
                                   nft.animalTypeName === "Cat" ? "🐱" :
                                   nft.animalTypeName === "Elephant" ? "🐘" : "🐾"}
                                </div>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-gray-900 truncate">{nft.name}</h3>
                                <div className="text-right ml-2">
                                  <div className="text-xs text-gray-500">Level {nft.level}</div>
                                </div>
                              </div>

                              <p className="text-sm text-gray-600 mb-3">{nft.animalTypeName}</p>

                              {/* Stats */}
                              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                                <div className="text-center p-1 bg-red-50 rounded">
                                  <div className="font-medium text-red-700">{nft.strength}</div>
                                  <div className="text-red-600">STR</div>
                                </div>
                                <div className="text-center p-1 bg-blue-50 rounded">
                                  <div className="font-medium text-blue-700">{nft.agility}</div>
                                  <div className="text-blue-600">AGI</div>
                                </div>
                                <div className="text-center p-1 bg-purple-50 rounded">
                                  <div className="font-medium text-purple-700">{nft.intelligence}</div>
                                  <div className="text-purple-600">INT</div>
                                </div>
                              </div>

                              {/* Seller */}
                              <div className="flex items-center text-xs text-gray-500 mb-3">
                                <User className="w-3 h-3 mr-1" />
                                {nft.seller.username || formatAddress(nft.seller.address)}
                              </div>

                              {/* Price */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs text-gray-500">
                                    {nft.isAuction ? "Current Bid" : "Price"}
                                  </div>
                                  <div className="font-bold text-lg flex items-center">
                                    <Coins className="w-4 h-4 mr-1 text-yellow-500" />
                                    {nft.isAuction ? nft.currentBid : nft.price} REWARD
                                  </div>
                                </div>
                                <Button 
                                  size="sm" 
                                  className="bg-indigo-600 hover:bg-indigo-700"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (nft.isAuction) {
                                      // Pour les enchères, on utilise le prix actuel + increment
                                      const newBid = (parseFloat(nft.currentBid || nft.price) + 5).toString();
                                      await placeBid(nft.id, newBid);
                                    } else {
                                      await buyNFT(nft.id);
                                    }
                                  }}
                                  disabled={loading}
                                >
                                  {nft.isAuction ? "Bid" : "Buy"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // List View
                          <div className="flex items-center p-4 space-x-4">
                            {/* Image */}
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-lg flex items-center justify-center relative flex-shrink-0">
                              <div className="text-2xl">
                                {nft.animalTypeName === "Tiger" ? "🐅" :
                                 nft.animalTypeName === "Fox" ? "🦊" :
                                 nft.animalTypeName === "Cat" ? "🐱" :
                                 nft.animalTypeName === "Elephant" ? "🐘" : "🐾"}
                              </div>
                              {nft.isAuction && (
                                <div className="absolute -top-1 -right-1">
                                  <Clock className="w-4 h-4 text-red-500" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-gray-900 truncate">{nft.name}</h3>
                                <Badge className={`${rarityColors[nft.rarity]} border text-xs`}>
                                  {rarityIcons[nft.rarity]} {nft.rarity}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                <span>{nft.animalTypeName}</span>
                                <span>Level {nft.level}</span>
                                <span className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  {nft.seller.username || formatAddress(nft.seller.address)}
                                </span>
                              </div>

                              <div className="flex items-center space-x-4 text-xs">
                                <span className="text-red-600">STR: {nft.strength}</span>
                                <span className="text-blue-600">AGI: {nft.agility}</span>
                                <span className="text-purple-600">INT: {nft.intelligence}</span>
                              </div>
                            </div>

                            {/* Price & Action */}
                            <div className="text-right flex-shrink-0">
                              {nft.isAuction && (
                                <div className="text-xs text-red-600 mb-1">
                                  {formatTimeRemaining(nft.auctionEndTime!)}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mb-1">
                                {nft.isAuction ? "Current Bid" : "Price"}
                              </div>
                              <div className="font-bold text-lg flex items-center justify-end mb-2">
                                <Coins className="w-4 h-4 mr-1 text-yellow-500" />
                                {nft.isAuction ? nft.currentBid : nft.price} REWARD
                              </div>
                              <Button 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-700"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (nft.isAuction) {
                                    const newBid = (parseFloat(nft.currentBid || nft.price) + 5).toString();
                                    await placeBid(nft.id, newBid);
                                  } else {
                                    await buyNFT(nft.id);
                                  }
                                }}
                                disabled={loading}
                              >
                                {nft.isAuction ? "Place Bid" : "Buy Now"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}