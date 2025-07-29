import { useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TreePine, Coins, TrendingUp, Gift, ArrowRightLeft, ChevronDown } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useBridge } from "../../hooks/useBridge";

export function AppDashboard() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { executeBridge, isLoading: isBridging, error: bridgeError, clearError } = useBridge();
  
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "near">("near");
  const [nearAccount, setNearAccount] = useState("");

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleBridge = async () => {
    if (!isConnected || !fromAmount) return;
    
    clearError();
    
    try {
      const result = await executeBridge({
        fromAmount,
        fromChain,
        toChain,
        nearAccount: toChain === 'near' ? nearAccount || 'user.testnet' : undefined
      });

      if (result.success) {
        console.log("Bridge successful:", result.txHash);
        // Reset form
        setFromAmount("");
        setToAmount("");
      } else {
        console.error("Bridge failed:", result.error);
      }
    } catch (error) {
      console.error("Bridge error:", error);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-slate-900 mb-2">
          Welcome {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Guest"}
        </h1>
        <p className="text-slate-600">
          Bridge your tokens between Ethereum and NEAR
        </p>
      </div>

      {/* Bridge Section */}
      <div className="max-w-md mx-auto">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* From Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">From</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={fromChain}
                      onChange={(e) => setFromChain(e.target.value as "ethereum" | "near")}
                      className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ethereum">ETH</option>
                      <option value="near">NEAR</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {isConnected && fromChain === "ethereum" && balance && (
                  <p className="text-xs text-slate-500">
                    Balance: {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
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
                <label className="text-sm font-medium text-slate-700">To</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={toAmount}
                      onChange={(e) => setToAmount(e.target.value)}
                      className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      disabled
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={toChain}
                      onChange={(e) => setToChain(e.target.value as "ethereum" | "near")}
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
              {toChain === 'near' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">NEAR Account</label>
                  <input
                    type="text"
                    placeholder="your-account.testnet"
                    value={nearAccount}
                    onChange={(e) => setNearAccount(e.target.value)}
                    className="w-full px-3 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Bridge Button */}
              <Button
                onClick={handleBridge}
                disabled={!isConnected || !fromAmount || isBridging || (toChain === 'near' && !nearAccount)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBridging ? "Bridging..." : `Bridge to ${toChain.toUpperCase()}`}
              </Button>

              {/* Error Display */}
              {bridgeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{bridgeError}</p>
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
                  <p>Using 1inch Fusion+ Cross-Chain Technology</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
