import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Activity,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useBridge } from "../../hooks/useBridge";
import { useBridgeHistory } from "../../hooks/useBridgeHistory";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland, FloatingIslandRef } from "./island/island";
import { ModernBridge } from "../../components/bridge/ModernBridge";

import { useIslands } from "../../hooks/useIslands";
import { generateIslandSeed } from "./island/island.generators";
import { useAuthContext } from "@/contexts/AuthContext";
import { ethers } from "ethers";
// import { useEscrowEventListener } from "../../hooks/useEscrowEventListener";

export function AppDashboard() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
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
  const { isAuthenticated } = useAuthContext();
  const {
    activeIsland,
    ensureUserHasIsland,
    autoSaveIsland,
    isLoading: islandsLoading,
  } = useIslands();

  useEffect(() => {
    const initializeUserIsland = async () => {
      if (isAuthenticated && !isInitialized && !islandsLoading) {
        try {
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

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

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
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="w-full px-10 pb-12">
        <div className="mx-0 lg:mx-10 h-fulll">
          <div className=" flex flex-wrap gap-5 h-full">
            <div className="container mx-auto px-4 h-full pt-5">
              {/* <Breadcrumb/> */}
              <div className="mt-10 flex flex-row gap-x-5 h-full w-full">
                {/* Left */}
                <div className="w-3/5">
                  <div className=" w-full flex flex-col gap-y-5 p-2">
                    <div className="h-full w-full">
                      <div className="w-full h-64 rounded-lg flex items-center justify-center backdrop-blur-sm pr-24 border-0">
                        {islandsLoading ||
                        !isInitialized ||
                        islandSeed === null ? (
                          <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
                          </div>
                        ) : (
                          <Canvas
                            shadows
                            camera={{ position: [15, 5, 10], fov: 40 }}
                          >
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
                            <pointLight
                              position={[-15, 15, -15]}
                              intensity={0.3}
                              color="#fff5ee"
                            />

                            <FloatingIsland seed={islandSeed} ref={islandRef} />

                            <fog attach="fog" args={["#87CEEB", 40, 80]} />
                          </Canvas>
                        )}
                      </div>
                    </div>

                    <div className="h-full w-full mt-5 pr-24">
                      <div className="flex gap-4">
                        <Card className="flex-1 bg-white/80 shadow border-0 ">
                          <CardContent className="px-4 flex flex-col items-center relative h-[20px]">
                            <span className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                              Trees planted
                              <span className="ml-1">
                                <span className="group relative">
                                  <svg
                                    className="w-4 h-4 text-emerald-600 cursor-pointer"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      fill="#d1fae5"
                                    />
                                    <text
                                      x="12"
                                      y="16"
                                      textAnchor="middle"
                                      fontSize="12"
                                      fill="#059669"
                                      fontWeight=""
                                    >
                                      i
                                    </text>
                                  </svg>
                                  <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-emerald-100 text-emerald-900 text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                    The more you use the bridge, the more trees
                                    are planted on your island 🌱
                                  </span>
                                </span>
                              </span>
                            </span>
                            <span className="text-2xl font-bold text-emerald-700">
                              {userIslandData?.totalTrees ?? 0}
                            </span>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 bg-white/80 shadow border-0">
                          <CardContent className="px-4 flex flex-col items-center">
                            <span className="text-sm text-slate-500 mb-1">
                              Island Seed
                            </span>
                            <span className="font-mono text-lg">
                              {islandSeed !== null ? islandSeed : "Loading..."}
                            </span>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                    <div className="h-full w-full">
                      <div className="flex items-center justify-between mt-7 mb-7 pr-24">
                        <h3 className="text-2xl font-medium text-neutral">
                          Bridge History
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshHistory}
                          disabled={isLoadingHistory}
                        >
                          {isLoadingHistory ? "Loading..." : "Refresh"}
                        </Button>
                      </div>
                      <div
                        className="overflow-x-auto overflow-y-auto w-5/6"
                        style={{ maxHeight: "300px" }}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead>Date/Time</TableHead>
                              <TableHead>From → To</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoadingHistory ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-8"
                                >
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Loading bridge history...
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : bridgeHistory.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-8 text-gray-500"
                                >
                                  {!isConnected
                                    ? "Connect your wallet to view bridge history"
                                    : "No bridge transactions found"}
                                </TableCell>
                              </TableRow>
                            ) : (
                              bridgeHistory.map((bridge) => (
                                <TableRow key={bridge.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {bridge.status === "COMPLETED" && (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      )}
                                      {bridge.status === "PENDING" && (
                                        <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />
                                      )}
                                      {bridge.status === "FAILED" && (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                      )}
                                      <span
                                        className={`text-xs font-semibold px-2 py-1 rounded ${
                                          bridge.status === "COMPLETED"
                                            ? "bg-green-100 text-green-700"
                                            : bridge.status === "PENDING"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {bridge.status}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      {new Date(
                                        bridge.createdAt
                                      ).toLocaleString()}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                        {bridge.fromChain === "ethereum"
                                          ? "🔷 ETH"
                                          : "🔺 NEAR"}
                                      </span>
                                      <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                        {bridge.toChain === "ethereum"
                                          ? "🔷 ETH"
                                          : "🔺 NEAR"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <span className="font-medium">
                                        {ethers.utils.formatEther(
                                          bridge.amount
                                        )}{" "}
                                        {bridge.fromChain === "ethereum"
                                          ? "ETH"
                                          : "NEAR"}
                                      </span>
                                      <div className="text-xs text-gray-500">
                                        ≈ $
                                        {(
                                          parseFloat(
                                            ethers.utils.formatEther(
                                              bridge.amount
                                            )
                                          ) * 2500
                                        ).toFixed(2)}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
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
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="h-full w-full">
                      <h3 className="text-2xl font-medium text-neutral my-5">
                        Profil Details
                      </h3>
                      <div className="w-full"></div>
                      <div className="w-2/2">
                        <div className="flex items-center my-2 space-x-4">
                          <div className="">
                            Account created on :{" "}
                            {userIslandData?.createdAt
                              ? new Date(
                                  userIslandData.createdAt
                                ).toLocaleString()
                              : "N/A"}
                          </div>
                        </div>
                        <div className="flex items-center my-2 space-x-4">
                          <a
                            href={`https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTmhZrL1E23KqqeL7bT24fbLqASfw81VGpj2PpUdzF9MA&s`}
                            className="font-medium"
                          >
                            {" "}
                            View on Etherscan{" "}
                          </a>
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 10 10"
                            fill="none"
                            width="10"
                            height="10"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M9 0.250061H1C0.585786 0.250061 0.25 0.585847 0.25 1.00006C0.25 1.41427 0.585786 1.75006 1 1.75006H7.18934L0.46967 8.46973C0.176777 8.76262 0.176777 9.2375 0.46967 9.53039C0.762563 9.82328 1.23744 9.82328 1.53033 9.53039L8.25 2.81072V9.00006C8.25 9.41428 8.58579 9.75006 9 9.75006C9.41421 9.75006 9.75 9.41428 9.75 9.00006V1.00006C9.75 0.808119 9.67678 0.616178 9.53033 0.469731C9.45842 0.397824 9.37555 0.34357 9.28709 0.30697C9.19866 0.2703 9.10169 0.250061 9 0.250061Z"
                              fill="currentColor"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right */}
                <div className="h-154 w-2/5 p-2">
                  {/* Bridge Section */}
                  <div className="sticky top-20 z-19 w-full">
                    <ModernBridge
                      onBridgeSuccess={(bridgeData) => {
                        // Increment tree count on successful bridge
                        setTreeCount((prev) => prev + 1);
                        // Trigger island update if needed
                        if (islandRef.current) {
                          // Island ref available for future use
                          console.log('Island ref available for tree update');
                        }
                        // Refresh bridge history to show the new transaction
                        setTimeout(() => {
                          refreshHistory();
                        }, 5000); // Wait 5 seconds then refresh
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
