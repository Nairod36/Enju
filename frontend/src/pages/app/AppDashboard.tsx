import { useState, useEffect, useRef } from "react";
import { ModernBridge } from "../../components/bridge/ModernBridge";
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
} from "lucide-react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { useBridge } from "../../hooks/useBridge";
import { useBridgeHistory } from "../../hooks/useBridgeHistory";
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
        return "Ethereum Mainnet";
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
  const {
    balances,
    isLoading: isLoadingBalances,
    error: balanceError,
  } = useMultiChainBalance();
  const {
    executeBridge,
    isLoading: isBridging,
    error: bridgeError,
    clearError,
  } = useBridge();
  const {
    bridges: bridgeHistory,
    isLoading: isLoadingHistory,
    refreshHistory,
  } = useBridgeHistory();

  const islandRef = useRef<FloatingIslandRef>(null);

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "near">("near");
  const [nearAccount, setNearAccount] = useState("");
  const [currentSwapHash, setCurrentSwapHash] = useState<string | null>(null);
  const [userIslandData, setUserIslandData] = useState<any>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [swapStatus, setSwapStatus] = useState<
    "idle" | "creating" | "monitoring" | "completed" | "failed"
  >("idle");
  const [treeCount, setTreeCount] = useState(0);
  const [islandSeed, setIslandSeed] = useState<number | null>(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

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

            // Check if this is a newly created island
            const isNewUser =
              !userIsland.islandData ||
              !userIsland.islandData.landTiles ||
              userIsland.islandData.landTiles.length === 0;

            if (isNewUser) {
              setShowWelcome(true);
              // Auto-hide welcome message after 8 seconds
              setTimeout(() => {
                setShowWelcome(false);
              }, 8000);
            }

            setIslandSeed(parseInt(userIsland.seed));
            setTreeCount(userIsland.totalTrees || 0);
            setUserIslandData(userIsland);

            // Charger l'état complet de l'île après que l'île soit rendue
            setTimeout(async () => {
              if (islandRef.current) {
                islandRef.current.loadFromDatabase(userIsland);

                // Si l'île n'a pas de données générées, sauvegarder les données actuelles
                const hasGeneratedData =
                  userIsland.islandData &&
                  userIsland.islandData.landTiles &&
                  userIsland.islandData.landTiles.length > 0;
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

  const handleBridge = async () => {
    if (!isConnected || !fromAmount) return;

    clearError();
    setSwapStatus("creating");

    try {
      const result = await executeBridge({
        fromAmount,
        fromChain,
        toChain,
        nearAccount:
          toChain === "near" ? nearAccount || "user.testnet" : undefined,
      });

      if (result.success) {
        console.log("Bridge successful:", result.txHash);
        setSwapStatus("monitoring");

        // Reset form
        setFromAmount("");
        setToAmount("");
      } else {
        console.error("Bridge failed:", result.error);
        setSwapStatus("failed");
      }
    } catch (error) {
      console.error("Bridge error:", error);
      setSwapStatus("failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome overlay for new users */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <WelcomeNewUser onDismiss={() => setShowWelcome(false)} />
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full pr-8 py-4 pl-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bridge</h1>
              <p className="text-sm text-gray-500 mt-1">
                Cross-chain asset transfers
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
                    {isLoadingBalances ? (
                      <span className="animate-pulse text-blue-500">
                        ⟳ Loading...
                      </span>
                    ) : balanceError ? (
                      <span className="text-red-500">Error</span>
                    ) : balances.tron ? (
                      `${balances.tron.formatted} TRX`
                    ) : (
                      "0.00 TRX"
                    )}
                  </div>
                  <div className="text-xs text-gray-500">TRON</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(85vh-80px)]">
        {/* Left Sidebar - Island Viewer */}
        <div className="w-[40%] bg-white border-r border-gray-200 flex flex-col">
          {/* Island Viewer */}
          <div className="flex-1 flex flex-col">
            <div className="pr-8 py-4 pl-20 border-b border-gray-200">
              <h3 className="text-md font-semibold text-gray-900">
                #{islandSeed || "..."} Island
              </h3>
            </div>

            <div className="flex-1">
              {!isConnected ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Connect wallet to view your island
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
          <div className="bg-gray-50 border-t border-gray-200 pr-8 py-6 pl-20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Island Seed
                </span>
                <span className="font-mono text-sm font-bold text-gray-900">
                  #{islandSeed || "..."}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Trees Planted
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {userIslandData?.totalTrees || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Bridges Completed
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {bridgeHistory.filter((b) => b.status === "COMPLETED").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Member Since
                </span>
                <span className="text-sm text-gray-900">
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
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-600">
                    Wallet
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-gray-900 pt-1">
                      {address.slice(0, 4)}...{address.slice(-4)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      onClick={() =>
                        window.open(
                          `https://etherscan.io/address/${address}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="w-2 h-2" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Bridge & Activity */}
        <div className="flex-1 bg-white flex flex-col">
          {/* Bridge Section */}
          <div className="px-8 py-8 border-b border-gray-200">
            {!isConnected ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-500 mb-6">
                  Connect to start bridging assets across chains
                </p>
                <w3m-button />
              </div>
            ) : (
              <ModernBridge
                onBridgeSuccess={() => {
                  setTreeCount((prev) => prev + 1);
                  setTimeout(() => {
                    refreshHistory();
                  }, 5000);
                }}
              />
            )}
          </div>

          {/* Recent Activity */}
          <div className="flex-1 flex flex-col">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Activity
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshHistory}
                  disabled={isLoadingHistory}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {isLoadingHistory ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                    <span className="text-gray-600">Loading...</span>
                  </div>
                </div>
              ) : bridgeHistory.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    No transactions yet
                  </h4>
                  <p className="text-xs text-gray-500">
                    {!isConnected
                      ? "Connect your wallet to view transactions"
                      : "Start bridging to see your activity here"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {bridgeHistory.map((bridge) => (
                    <div
                      key={bridge.id}
                      className="py-4 hover:bg-gray-50 transition-colors -mx-8 px-8"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              bridge.status === "COMPLETED"
                                ? "bg-green-100"
                                : bridge.status === "PENDING"
                                ? "bg-yellow-100"
                                : "bg-red-100"
                            }`}
                          >
                            {bridge.status === "COMPLETED" && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {bridge.status === "PENDING" && (
                              <Activity className="w-5 h-5 text-yellow-600 animate-pulse" />
                            )}
                            {bridge.status === "FAILED" && (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatAmount(bridge.amount).toFixed(4)}{" "}
                              {bridge.fromChain === "ethereum" ? "ETH" : "NEAR"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {bridge.fromChain === "ethereum"
                                ? "Ethereum"
                                : "NEAR"}{" "}
                              →{" "}
                              {bridge.toChain === "ethereum"
                                ? "Ethereum"
                                : "NEAR"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            $
                            {(
                              formatAmount(bridge.amount) * 2500
                            ).toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                          <div className="flex items-center space-x-1 mt-1 justify-end">
                            {bridge.ethTxHash && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  window.open(
                                    `https://etherscan.io/tx/${bridge.ethTxHash}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                            {bridge.nearTxHash && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  window.open(
                                    `https://testnet.nearblocks.io/txns/${bridge.nearTxHash}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
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
    </div>
  );
}
