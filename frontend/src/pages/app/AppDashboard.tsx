import { useState, useEffect, useRef } from "react";
import { ModernBridge } from "../../components/bridge/ModernBridge";
import { CompactSwap } from "../../components/swap/CompactSwap";
import { Button } from "../../components/ui/button";
import {
  ArrowRightLeft,
  Activity,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  MapPin,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  Repeat,
  GitBranch,
} from "lucide-react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { useBridge } from "../../hooks/useBridge";
import { useTokenBalances } from "../../hooks/useTokenBalances";
import { useBridgeHistory } from "../../hooks/useBridgeHistory";
import { RewardDisplay } from "../../components/rewards/RewardDisplay";
import { useTronWallet } from "../../hooks/useTronWallet";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland, FloatingIslandRef } from "./island/island";

import { MintEthButton } from "../../components/bridge/MintEthButton";
import { WelcomeNewUser } from "../../components/welcome/WelcomeNewUser";

import { useIslands } from "../../hooks/useIslands";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMultiChainBalance } from "../../hooks/useMultiChainBalance";
import { ethers } from "ethers";
// import { useEscrowEventListener } from "../../hooks/useEscrowEventListener";

export function AppDashboard() {
  // Function to get network name
  const getNetworkName = (chainId: number | undefined) => {
    switch (chainId) {
      case 1:
        return "Ethereum Fork Mainnet";
      case 11155111:
        return "Sepolia Testnet";
      case 31337:
        return "Fork Mainnet";
      default:
        return chainId ? `Network ${chainId}` : "Unknown Network";
    }
  };

  // Utility function to safely format amount
  const formatAmount = (amount: any): number => {
    if (!amount) return 0;
    try {
      if (typeof amount === "string" && amount.includes(".")) {
        return parseFloat(amount);
      } else {
        return parseFloat(ethers.utils.formatEther(amount));
      }
    } catch (error) {
      return parseFloat(amount.toString()) || 0;
    }
  };

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const { getTokenBalance, isLoading: tokenBalancesLoading } =
    useTokenBalances();
  const {
    balances,
    isLoading: isLoadingBalances,
    error: balanceError,
  } = useMultiChainBalance();
  // TRON wallet hook for direct balance access
  const {
    balance: tronBalance,
    isConnected: tronConnected,
    isLoading: tronLoading,
  } = useTronWallet();

  const {
    bridges: bridgeHistory,
    isLoading: isLoadingHistory,
    refreshHistory,
  } = useBridgeHistory();

  const islandRef = useRef<FloatingIslandRef>(null);

  const [userIslandData, setUserIslandData] = useState<any>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  const [treeCount, setTreeCount] = useState(0);
  const [islandSeed, setIslandSeed] = useState<number | null>(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasCheckedUserStatus, setHasCheckedUserStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<"bridge" | "swap">("bridge");

  // Bridge statistics
  const [bridgeStats, setBridgeStats] = useState({
    totalVolume: "0.00",
    totalTransactions: 0,
    avgTime: "45s",
    successRate: "0.0",
  });

  const { isAuthenticated } = useAuthContext();
  const {
    activeIsland,
    ensureUserHasIsland,
    autoSaveIsland,
    isLoading: islandsLoading,
  } = useIslands();

  // Vérifier le statut utilisateur pour détecter les nouveaux utilisateurs
  const checkUserStatus = async () => {
    if (!address || hasCheckedUserStatus) return;

    try {
      // Vérifier si l'utilisateur existe déjà dans la base
      const response = await fetch(
        `http://localhost:3001/api/v1/users/check-exists?address=${address}`
      );
      const data = await response.json();

      console.log("User check result:", data);

      // Si l'utilisateur n'existe pas OU n'a pas de pseudo, afficher le welcome
      if (!data.exists || !data.user?.username) {
        console.log(
          "New user detected or user without username, showing welcome"
        );
        setShowWelcome(true);
      }

      setHasCheckedUserStatus(true);
    } catch (error) {
      console.error("Failed to check user status:", error);
      setHasCheckedUserStatus(true);
    }
  };

  useEffect(() => {
    const initializeUserIsland = async () => {
      if (isAuthenticated && isConnected && !isInitialized && !islandsLoading) {
        try {
          // Check if this is a new user by looking at existing data first
          const userIsland = await ensureUserHasIsland();
          if (userIsland) {
            console.log("User island data:", userIsland);
            console.log("Total trees from DB:", userIsland.totalTrees);
            console.log("User trees array:", userIsland.userTrees);
            console.log(
              "User trees length:",
              userIsland.userTrees?.length || 0
            );

            setIslandSeed(parseInt(userIsland.seed));
            setTreeCount(userIsland.totalTrees || 0);
            setUserIslandData(userIsland);

            // Charger l'état complet de l'île après que l'île soit rendue
            setTimeout(async () => {
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

  // Effet séparé pour vérifier le statut utilisateur
  useEffect(() => {
    if (isConnected && address) {
      checkUserStatus();
    }
  }, [isConnected, address]);

  // Réinitialiser les états quand l'utilisateur se déconnecte
  useEffect(() => {
    if (!isConnected) {
      setHasCheckedUserStatus(false);
      setShowWelcome(false);
      setIsInitialized(false);
    }
  }, [isConnected]);

  // Load bridge statistics
  useEffect(() => {
    const loadBridgeStats = async () => {
      try {
        const response = await fetch("/api/bridges");
        const result = await response.json();

        if (result.success) {
          const bridges = result.data;
          const totalVol = bridges.reduce((sum: number, bridge: any) => {
            return sum + parseFloat(bridge.amount || 0);
          }, 0);

          const completed = bridges.filter(
            (b: any) => b.status === "COMPLETED"
          );
          const successRate =
            bridges.length > 0 ? (completed.length / bridges.length) * 100 : 0;

          setBridgeStats({
            totalVolume: totalVol.toFixed(2),
            totalTransactions: bridges.length,
            avgTime: "45s",
            successRate: successRate.toFixed(1),
          });
        }
      } catch (error) {
        console.error("Failed to load bridge stats:", error);
      }
    };

    loadBridgeStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Welcome overlay for new users */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <WelcomeNewUser onDismiss={() => setShowWelcome(false)} />
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-full pr-8 py-6 pl-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">
                Bridge / Swap Platform
              </h1>
              <p className="text-slate-600 mt-1">
                Seamless cross-chain asset transfers and token swapping
              </p>
            </div>
            {isConnected && (
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <MintEthButton />
                  {/* Network indicator bubble */}
                  <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    {getNetworkName(chainId)}
                  </div>
                  {/* Explorer Link */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-full"
                    onClick={() =>
                      window.open("http://vps-b11044fd.vps.ovh.net/", "_blank")
                    }
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Explorer
                  </Button>
                </div>
                <div className="w-px h-8 bg-gray-200"></div>

                {/* ETH Balance */}
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {isLoadingBalances ? (
                      <span className="animate-pulse text-blue-500">
                        ⟳ Loading...
                      </span>
                    ) : balanceError ? (
                      <span className="text-red-500">Error</span>
                    ) : balances.eth ? (
                      `${balances.eth.formatted} ETH`
                    ) : (
                      "0.0000 ETH"
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Ethereum</div>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                {/* NEAR Balance */}
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {isLoadingBalances ? (
                      <span className="animate-pulse text-blue-500">
                        ⟳ Loading...
                      </span>
                    ) : balanceError ? (
                      <span className="text-red-500">Error</span>
                    ) : balances.near ? (
                      `${balances.near.formatted} NEAR`
                    ) : (
                      "0.0000 NEAR"
                    )}
                  </div>
                  <div className="text-xs text-gray-500">NEAR Protocol</div>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                {/* TRON Balance */}
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {tronLoading ? (
                      <span className="animate-pulse text-blue-500">
                        ⟳ Loading...
                      </span>
                    ) : !tronConnected ? (
                      <span className="text-gray-400">Not connected</span>
                    ) : tronBalance ? (
                      `${parseFloat(tronBalance).toFixed(2)} TRX`
                    ) : (
                      "0.00 TRX"
                    )}
                  </div>
                  <div className="text-xs text-gray-500">TRON</div>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                {/* REWARD Token Balance */}
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-600">
                    {tokenBalancesLoading ? (
                      <span className="animate-pulse text-blue-500">
                        ⟳ Loading...
                      </span>
                    ) : (
                      (() => {
                        const rewardBalance = getTokenBalance(
                          "0x012EB96bcc36d3c32847dB4AC416B19Febeb9c54"
                        );
                        return rewardBalance
                          ? `${parseFloat(rewardBalance.formatted).toFixed(
                              4
                            )} REWARD`
                          : "0.0000 REWARD";
                      })()
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Reward Tokens</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(85vh-80px)]">
        {/* Left Sidebar - Island Viewer */}
        <div className="w-[40%] bg-white border-r border-slate-200 flex flex-col shadow-sm">
          {/* Island Viewer */}
          <div className="flex-1 flex flex-col">
            <div className="pr-8 py-6 pl-20 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                #{islandSeed || "..."} Island
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Your personal ecosystem
              </p>
            </div>

            <div className="flex-1">
              {!isConnected ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-2">
                      Connect Wallet
                    </h4>
                    <p className="text-sm text-slate-500">
                      Connect your wallet to explore your island
                    </p>
                  </div>
                </div>
              ) : islandsLoading || !isInitialized || islandSeed === null ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 text-sm">Loading island...</p>
                  </div>
                </div>
              ) : (
                <Canvas shadows camera={{ position: [15, 5, 10], fov: 40 }}>
                  <OrbitControls
                    enablePan={true}
                    minDistance={5}
                    maxDistance={100}
                    maxPolarAngle={Math.PI}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
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
                  <fog attach="fog" args={["#e6f3ff", 40, 90]} />

                  <FloatingIsland ref={islandRef} seed={islandSeed} />
                </Canvas>
              )}
            </div>
          </div>

          {/* Island Stats */}
          <div className="bg-gradient-to-br from-slate-50 to-white border-t border-slate-100 pr-8 py-6 pl-20">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Island Seed
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                  #{islandSeed || "..."}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Trees Planted
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm font-bold text-emerald-700">
                    {userIslandData?.totalTrees || 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Bridges Completed
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-bold text-blue-700">
                    {
                      bridgeHistory.filter((b) => b.status === "COMPLETED")
                        .length
                    }
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Member Since
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {userIslandData?.createdAt
                    ? new Date(userIslandData.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "Aug 2025"}
                </span>
              </div>
              {address && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Wallet Address
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-200 rounded-lg"
                        onClick={() =>
                          window.open(
                            `https://etherscan.io/address/${address}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reward Display */}
          {/* <div className="px-4 pb-4">
            <RewardDisplay />
          </div> */}
        </div>

        {/* Main Content - Bridge & Activity */}
        <div className="flex items-center align-center justify-center flex-1">
          {/* Bridge Section - Sticky */}

          {!isConnected ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-3">
                Connect Your Wallet
              </h2>
              <p className="text-slate-600 mb-8 text-lg">
                Connect to start bridging assets across chains
              </p>
            </div>
          ) : activeTab === "bridge" ? (
            <div className="sticky top-0 z-10 w-[500px]">
              <div className="px-8 py-8">
                {/* Tab Toggle - Premium Style - Au-dessus du composant */}
                <div className="flex justify-center mb-6">
                  <div className="relative bg-slate-50 rounded-xl p-1 border border-slate-200">
                    <div
                      className={`absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ${
                        activeTab === "bridge"
                          ? "left-1 right-[50%]"
                          : "left-[50%] right-1"
                      }`}
                    />
                    <div className="relative flex">
                      <button
                        onClick={() => setActiveTab("bridge")}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all relative z-10 ${
                          activeTab === "bridge"
                            ? "text-emerald-700"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <GitBranch className="w-4 h-4" />
                        <span>Bridge</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("swap")}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all relative z-10 ${
                          activeTab === "swap"
                            ? "text-blue-700"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <Repeat className="w-4 h-4" />
                        <span>Swap</span>
                      </button>
                    </div>
                  </div>
                </div>

                <ModernBridge
                  onBridgeSuccess={() => {
                    setTreeCount((prev) => prev + 1);
                    setTimeout(() => {
                      refreshHistory();
                    }, 5000);
                  }}
                />
              </div>
            </div>
          ) : (
            <CompactSwap />
          )}
        </div>
      </div>
    </div>
  );
}
