import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Activity,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useBridge } from "../../hooks/useBridge";
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

import { useIslands } from "../../hooks/useIslands";
import { generateIslandSeed } from "./island/island.generators";
import { useAuthContext } from "@/contexts/AuthContext";
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
            console.log("User trees length:", userIsland.userTrees?.length || 0);
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
                        <Card className="flex-1 bg-white/80 shadow border-0">
                          <CardContent className="p-4 flex flex-col items-center relative">
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
                          <CardContent className="p-4 flex flex-col items-center">
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
                      <h3 className="text-2xl font-medium text-neutral mt-7 mb-7">
                        Historical
                      </h3>
                      <div
                        className="overflow-x-auto overflow-y-auto w-5/6"
                        style={{ maxHeight: "300px" }}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>From</TableHead>
                              <TableHead>Date/Time</TableHead>
                              <TableHead>To</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Bridge</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[
                              {
                                transactionHash: "0xeth2near1",
                                from: "0xA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0",
                                to: "alice.near",
                                fromChain: "ethereum",
                                toChain: "near",
                                timestamp: Date.now() - 1000 * 60 * 60 * 2,
                                value: "0.5",
                              },
                              {
                                transactionHash: "0xnear2eth1",
                                from: "bob.near",
                                to: "0xB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1",
                                fromChain: "near",
                                toChain: "ethereum",
                                timestamp: Date.now() - 1000 * 60 * 60 * 24,
                                value: "1.2",
                              },
                              {
                                transactionHash: "0xeth2near2",
                                from: "0xE5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4",
                                to: "carol.near",
                                fromChain: "ethereum",
                                toChain: "near",
                                timestamp: Date.now() - 1000 * 60 * 60 * 48,
                                value: "0.8",
                              },
                              {
                                transactionHash: "0xnear2eth2",
                                from: "dave.near",
                                to: "0xF6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5",
                                fromChain: "near",
                                toChain: "ethereum",
                                timestamp: Date.now() - 1000 * 60 * 60 * 72,
                                value: "2.0",
                              },
                            ].map((transaction, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  {transaction.fromChain === "ethereum" ? (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${transaction.transactionHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 underline"
                                    >
                                      <span className="font-medium">
                                        {transaction.from.slice(0, 6)}...
                                        {transaction.from.slice(-4)}
                                      </span>
                                    </a>
                                  ) : (
                                    <span className="font-medium">
                                      {transaction.from}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {new Date(
                                    transaction.timestamp
                                  ).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {transaction.toChain === "ethereum" ? (
                                    <span className="font-medium">
                                      {transaction.to.slice(0, 6)}...
                                      {transaction.to.slice(-4)}
                                    </span>
                                  ) : (
                                    <span className="font-medium">
                                      {transaction.to}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <p>
                                    {transaction.value}{" "}
                                    {transaction.fromChain === "ethereum"
                                      ? "ETH"
                                      : "NEAR"}{" "}
                                    ={" "}
                                    {(
                                      parseFloat(transaction.value) *
                                      (transaction.fromChain === "ethereum"
                                        ? 2000
                                        : 5)
                                    ).toFixed(2)}{" "}
                                    $
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                    {transaction.fromChain.toUpperCase()} →{" "}
                                    {transaction.toChain.toUpperCase()}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
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
                  <div className="sticky top-20 z-19 w-full ">
                    <div className="max-w-md mx-auto mb-8">
                      <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            {/* Swap Status Indicator */}
                            {swapStatus !== "idle" && (
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                {swapStatus === "creating" && (
                                  <>
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm text-slate-600">
                                      Creating swap transaction...
                                    </span>
                                  </>
                                )}
                                {swapStatus === "monitoring" && (
                                  <>
                                    <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />
                                    <span className="text-sm text-slate-600">
                                      Monitoring for escrow events...
                                    </span>
                                  </>
                                )}
                                {swapStatus === "completed" && (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-green-600">
                                      Swap completed successfully!
                                    </span>
                                  </>
                                )}
                                {swapStatus === "failed" && (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <span className="text-sm text-red-600">
                                      Swap failed
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                            {/* From Section */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                From
                              </label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    placeholder="0.0"
                                    value={fromAmount}
                                    onChange={(e) =>
                                      setFromAmount(e.target.value)
                                    }
                                    className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                                <div className="relative">
                                  <select
                                    value={fromChain}
                                    onChange={(e) =>
                                      setFromChain(
                                        e.target.value as "ethereum" | "near"
                                      )
                                    }
                                    className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    <option value="ethereum">ETH</option>
                                    <option value="near">NEAR</option>
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                              {isConnected &&
                                fromChain === "ethereum" &&
                                balance && (
                                  <p className="text-xs text-slate-500">
                                    Balance:{" "}
                                    {parseFloat(balance.formatted).toFixed(4)}{" "}
                                    {balance.symbol}
                                  </p>
                                )}
                            </div>

                            {/* Swap Button */}
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSwapChains}
                                className="rounded-full w-10 h-10 p-0 hover:bg-emerald-50"
                              >
                                <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                              </Button>
                            </div>

                            {/* To Section */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                To
                              </label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    placeholder="0.0"
                                    value={toAmount}
                                    onChange={(e) =>
                                      setToAmount(e.target.value)
                                    }
                                    className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    disabled
                                  />
                                </div>
                                <div className="relative">
                                  <select
                                    value={toChain}
                                    onChange={(e) =>
                                      setToChain(
                                        e.target.value as "ethereum" | "near"
                                      )
                                    }
                                    className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    <option value="near">NEAR</option>
                                    <option value="ethereum">ETH</option>
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>

                            {/* NEAR Account Input (when bridging to NEAR) */}
                            {toChain === "near" && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  NEAR Account
                                </label>
                                <input
                                  type="text"
                                  placeholder="your-account.testnet"
                                  value={nearAccount}
                                  onChange={(e) =>
                                    setNearAccount(e.target.value)
                                  }
                                  className="w-full px-3 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            )}

                            {/* Bridge Button */}
                            <Button
                              onClick={handleBridge}
                              disabled={
                                !isConnected ||
                                !fromAmount ||
                                isBridging ||
                                (toChain === "near" && !nearAccount)
                              }
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isBridging
                                ? "Bridging..."
                                : `Bridge to ${toChain.toUpperCase()}`}
                            </Button>

                            {/* Error Display */}
                            {bridgeError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-700">
                                  {bridgeError}
                                </p>
                              </div>
                            )}

                            {/* Connection Status */}
                            {!isConnected && (
                              <p className="text-center text-sm text-slate-500">
                                Connect your wallet to start bridging
                              </p>
                            )}

                            {isConnected && (
                              <div className="text-center text-xs text-slate-400">
                                <p>✅ Wallet connected</p>
                                <p>
                                  Using 1inch Fusion+ Cross-Chain Technology
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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
