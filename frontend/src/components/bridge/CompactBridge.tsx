import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, Zap } from "lucide-react";
import { useAccount, useBalance } from "wagmi";

interface CompactBridgeProps {
  onBridgeSuccess?: (bridgeData: any) => void;
}

const chainConfig = {
  ethereum: { name: "Ethereum", symbol: "ETH", logo: "🔷" },
  near: { name: "NEAR", symbol: "NEAR", logo: "🔺" },
  tron: { name: "TRON", symbol: "TRX", logo: "🔴" },
};

export function CompactBridge({ onBridgeSuccess }: CompactBridgeProps) {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  const [fromChain, setFromChain] = useState<"ethereum" | "near" | "tron">(
    "ethereum"
  );
  const [toChain, setToChain] = useState<"ethereum" | "near" | "tron">("near");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const formatBalance = () => {
    if (!balance?.value) return "0.0000";
    return parseFloat(balance.formatted).toFixed(4);
  };

  const swapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
    setAmount("");
  };

  const canBridge = () => {
    return (
      amount &&
      parseFloat(amount) > 0 &&
      isConnected &&
      parseFloat(amount) <= parseFloat(balance?.formatted || "0")
    );
  };

  const handleBridge = async () => {
    if (!canBridge()) return;

    setIsLoading(true);
    try {
      // Simulate bridge transaction
      await new Promise((resolve) => setTimeout(resolve, 2000));

      onBridgeSuccess?.({
        amount,
        fromChain,
        toChain,
        txHash: "0x" + Math.random().toString(16).substr(2, 8),
      });

      setAmount("");
    } catch (error) {
      console.error("Bridge failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Bridge Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bridge</h2>
          <p className="text-xs text-gray-500">Cross-chain transfers</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-gray-600 font-medium">Active</span>
        </div>
      </div>

      {/* From Chain */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            From
          </span>
          <span className="text-xs text-gray-500">
            Balance:{" "}
            {isConnected
              ? parseFloat(balance?.formatted || "0").toFixed(4)
              : "0.0000"}{" "}
            ETH
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium">
            {chainConfig[fromChain].logo} {chainConfig[fromChain].name}
          </div>

          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {!isConnected && (
          <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
            ⚠️ Connect wallet to continue
          </div>
        )}
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <button
          onClick={swapChains}
          className="p-2 bg-white border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          <ArrowDown className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* To Chain */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            To
          </span>
          <span className="text-xs text-gray-500">Estimated</span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium">
            {chainConfig[toChain].logo} {chainConfig[toChain].name}
          </div>

          <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-right font-medium text-gray-500">
            {amount ? parseFloat(amount).toFixed(4) : "0.0"}
          </div>
        </div>
      </div>

      {/* Bridge Info */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <Zap className="w-3 h-3" />
            <span>~30s</span>
          </div>
          <div>Fee: ~$2.50</div>
        </div>
        <div>Rate: 1:1</div>
      </div>

      {/* Bridge Button */}
      <Button
        onClick={handleBridge}
        disabled={!canBridge() || isLoading}
        className={`w-full py-2.5 text-sm font-semibold transition-all ${
          canBridge() && !isLoading
            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Bridging...</span>
          </div>
        ) : !isConnected ? (
          "Connect Wallet"
        ) : !amount || parseFloat(amount) <= 0 ? (
          "Enter Amount"
        ) : parseFloat(amount) > parseFloat(balance?.formatted || "0") ? (
          "Insufficient Balance"
        ) : (
          `Bridge ${amount} ETH`
        )}
      </Button>
    </div>
  );
}
