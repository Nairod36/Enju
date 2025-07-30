import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Zap,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";
import { BridgeModal } from "./BridgeModal";
import { useAccount } from "wagmi";
import { useCustomBalance } from "@/hooks/useCustomBalance";
import { useNearWallet } from "@/hooks/useNearWallet";
import { ethers } from "ethers";
import { BRIDGE_CONFIG } from "@/config/networks";

interface ModernBridgeProps {
  onBridgeSuccess?: (bridgeData: any) => void;
}

interface BridgeStats {
  totalVolume: string;
  totalTransactions: number;
  avgTime: string;
  successRate: string;
}

const chainLogos = {
  ethereum: "🔷",
  near: "🔺",
};

const chainNames = {
  ethereum: "Ethereum",
  near: "NEAR Protocol",
};

export function ModernBridge({ onBridgeSuccess }: ModernBridgeProps) {
  const { address, isConnected, chainId } = useAccount();
  const { balance, isLoading: balanceLoading } = useCustomBalance();
  const {
    accountId: nearAccountId,
    isConnected: nearConnected,
    balance: nearBalance,
  } = useNearWallet();

  // Debug logging
  useEffect(() => {
    console.log("🔍 ModernBridge Debug:", {
      address,
      isConnected,
      chainId,
      balance: balance
        ? {
            formatted: balance.formatted,
            symbol: balance.symbol,
            value: balance.value?.toString(),
            decimals: balance.decimals,
          }
        : null,
      expectedChainId: 1,
      isMainnet: chainId === 1,
    });
  }, [address, isConnected, chainId, balance]);

  // Test RPC connection directly
  useEffect(() => {
    const testRpc = async () => {
      if (address && chainId === 1) {
        try {
          console.log("🧪 Testing RPC connection directly...");
          const response = await fetch(
            "http://vps-b11044fd.vps.ovh.net:8545/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBalance",
                params: [address, "latest"],
                id: 1,
              }),
            }
          );
          const result = await response.json();
          console.log("🧪 Direct RPC result:", result);

          if (result.result) {
            const balanceWei = BigInt(result.result);
            const balanceEth = Number(balanceWei) / 1e18;
            console.log("🧪 Direct balance:", balanceEth, "ETH");
          }
        } catch (error) {
          console.error("🚨 RPC test failed:", error);
        }
      }
    };

    testRpc();
  }, [address, chainId]);

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "near">("near");
  // Remove nearAccount state as it will come from wallet
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bridgeData, setBridgeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<BridgeStats>({
    totalVolume: "0",
    totalTransactions: 0,
    avgTime: "0",
    successRate: "0",
  });

  // Load bridge stats
  useEffect(() => {
    loadBridgeStats();
  }, []);

  // Auto-calculate to amount (1:1 ratio for demo)
  useEffect(() => {
    if (fromAmount && !isNaN(Number(fromAmount))) {
      setToAmount(fromAmount);
    } else {
      setToAmount("");
    }
  }, [fromAmount]);

  const loadBridgeStats = async () => {
    try {
      const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
      const result = await response.json();

      if (result.success) {
        const bridges = result.data;
        const totalVol = bridges.reduce((sum: number, bridge: any) => {
          return (
            sum + parseFloat(ethers.utils.formatEther(bridge.amount || "0"))
          );
        }, 0);

        const completed = bridges.filter((b: any) => b.status === "COMPLETED");
        const successRate =
          bridges.length > 0 ? (completed.length / bridges.length) * 100 : 0;

        setStats({
          totalVolume: totalVol.toFixed(2),
          totalTransactions: bridges.length,
          avgTime: "45s", // Mock data
          successRate: successRate.toFixed(1),
        });
      }
    } catch (error) {
      console.error("Failed to load bridge stats:", error);
    }
  };

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleBridge = async () => {
    // Check required connections based on bridge direction
    const needsEthWallet = fromChain === "ethereum" || toChain === "ethereum";
    const needsNearWallet = fromChain === "near" || toChain === "near";

    if (needsEthWallet && !isConnected) return;
    if (needsNearWallet && !nearConnected) return;
    if (!fromAmount) return;

    setIsLoading(true);

    const newBridgeData = {
      fromAmount,
      fromChain,
      toChain,
      nearAccount: toChain === "near" ? nearAccountId : undefined,
    };

    setBridgeData(newBridgeData as any);
    setIsModalOpen(true);
    setIsLoading(false);

    // Mock success callback
    setTimeout(() => {
      onBridgeSuccess?.(newBridgeData);
      loadBridgeStats(); // Refresh stats
    }, 10000);
  };

  const getChainColor = (chain: string) => {
    return chain === "ethereum"
      ? "from-blue-500 to-blue-600"
      : "from-purple-500 to-purple-600";
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header - Ultra Compact */}
        <div className="text-center space-y-0.5">
          <h2 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Cross-Chain Bridge
          </h2>
          <p className="text-xs text-gray-500">
            Powered by 1inch Fusion+ Technology
          </p>
        </div>

        {/* Stats Cards - Ultra Compact */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-3.5 rounded-md border border-emerald-200">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                Volume
              </span>
            </div>
            <p className="text-xs font-bold text-emerald-800">
              ${(parseFloat(stats.totalVolume) * 2500).toLocaleString()}
            </p>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3.5 rounded-md border border-blue-200">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Success</span>
            </div>
            <p className="text-xs font-bold text-blue-800">
              {stats.successRate}%
            </p>
          </div>
        </div>

        {/* Main Bridge Card - Compact */}
        <Card className="overflow-hidden">
          <CardContent className="px-3 bg-white/90 backdrop-blur-sm rounded-lg">
            <div className="space-y-2.5">
              {/* From Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="text-lg">{chainLogos[fromChain]}</span>
                    From {chainNames[fromChain]}
                  </label>
                  {fromChain === "ethereum" && isConnected && (
                    <div className="text-xs text-gray-500">
                      {balanceLoading ? (
                        <div>
                          <p>Loading balance...</p>
                          <p className="text-xs text-gray-400">
                            Chain: {chainId}
                          </p>
                        </div>
                      ) : balance ? (
                        <div>
                          <p>
                            Balance: {parseFloat(balance.formatted).toFixed(4)}{" "}
                            {balance.symbol}
                          </p>
                          <p className="text-xs text-gray-400">
                            Fork Mainnet ✅
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p>No balance available</p>
                        </div>
                      )}
                    </div>
                  )}
                  {fromChain === "near" && nearConnected && (
                    <div className="text-xs text-gray-500">
                      {nearBalance ? (
                        <div>
                          <p>Balance: {nearBalance} NEAR</p>
                          <p className="text-xs text-gray-400">
                            NEAR Testnet ✅
                          </p>
                        </div>
                      ) : (
                        <p>Loading NEAR balance...</p>
                      )}
                    </div>
                  )}
                  {fromChain === "ethereum" && !isConnected && (
                    <p className="text-xs text-red-500">
                      Connect Ethereum wallet
                    </p>
                  )}
                  {fromChain === "near" && !nearConnected && (
                    <p className="text-xs text-red-500">Connect NEAR wallet</p>
                  )}
                </div>

                <div className="relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getChainColor(
                      fromChain
                    )} opacity-5 rounded-lg`}
                  ></div>
                  <div className="relative flex gap-2 p-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/80">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400"
                      step="0.01"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                      <span className="text-lg">{chainLogos[fromChain]}</span>
                      <select
                        value={fromChain}
                        onChange={(e) =>
                          setFromChain(e.target.value as "ethereum" | "near")
                        }
                        className="bg-transparent border-none outline-none font-semibold cursor-pointer"
                      >
                        <option value="ethereum">ETH</option>
                        <option value="near">NEAR</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Button - Compact */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwapChains}
                  className="rounded-full w-8 h-8 p-0 bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border border-gray-200 shadow-sm"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-lg">{chainLogos[toChain]}</span>
                  To {chainNames[toChain]}
                </label>

                <div className="relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getChainColor(
                      toChain
                    )} opacity-5 rounded-lg`}
                  ></div>
                  <div className="relative flex gap-2 p-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/80">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={toAmount}
                      readOnly
                      className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-600"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                      <span className="text-lg">{chainLogos[toChain]}</span>
                      <select
                        value={toChain}
                        onChange={(e) =>
                          setToChain(e.target.value as "ethereum" | "near")
                        }
                        className="bg-transparent border-none outline-none font-semibold cursor-pointer"
                      >
                        <option value="near">NEAR</option>
                        <option value="ethereum">ETH</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* NEAR Account Display */}
              {toChain === "near" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    NEAR Account
                  </label>
                  {nearConnected && nearAccountId ? (
                    <div className="w-full px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        <span className="text-purple-700 font-mono">
                          {nearAccountId}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full px-2.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      Please connect your NEAR wallet
                    </div>
                  )}
                </div>
              )}

              {/* Bridge Info - Ultra Compact */}
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-1.5 rounded-lg border border-emerald-200/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span className="font-medium text-gray-700">Time</span>
                  </div>
                  <span className="font-bold text-emerald-700">~45s</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-gray-700">Fee</span>
                  </div>
                  <span className="font-bold text-blue-700">Free</span>
                </div>
              </div>

              {/* Testnet Links */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-1.5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600">
                    Need testnet tokens?
                  </span>
                  <div className="flex gap-2">
                    <a
                      href="https://faucet.paradigm.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      ETH Faucet
                    </a>
                    <span className="text-gray-400">•</span>
                    <a
                      href="https://near-faucet.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 font-medium underline"
                    >
                      NEAR Faucet
                    </a>
                  </div>
                </div>
              </div>

              {/* Bridge Button - Ultra Compact */}
              <Button
                onClick={handleBridge}
                disabled={
                  !fromAmount ||
                  isLoading ||
                  (fromChain === "ethereum" && !isConnected) ||
                  (fromChain === "near" && !nearConnected) ||
                  (toChain === "near" && !nearConnected) ||
                  (toChain === "ethereum" && !isConnected)
                }
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (fromChain === "ethereum" && !isConnected) ||
                  (fromChain === "near" && !nearConnected) ? (
                  "Connect Wallet"
                ) : (toChain === "ethereum" && !isConnected) ||
                  (toChain === "near" && !nearConnected) ? (
                  "Connect Destination Wallet"
                ) : (
                  `Bridge ${
                    fromAmount || "0"
                  } ${fromChain.toUpperCase()} → ${toChain.toUpperCase()}`
                )}
              </Button>

              {/* Connection Status - Compact */}
              {isConnected && (
                <div className="text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Secured by 1inch Fusion+</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bridge Modal */}
      <BridgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bridgeData={bridgeData}
      />
    </>
  );
}
