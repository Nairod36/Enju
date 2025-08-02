import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/auth";

interface SwapQuote {
  toAmount: string;
  tx: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

const TOKENS = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC real address
};

export const SwapComponent: React.FC = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { isAuthenticated } = useAuth();

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("0");

  const API_BASE = process.env.VITE_API_URL || "http://localhost:3001/api/v1";

  const checkUsdcBalance = async () => {
    if (!publicClient || !address) return;

    try {
      const balance = await publicClient.readContract({
        address: TOKENS.USDC as `0x${string}`,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [address],
      });

      // USDC a 6 décimales
      const formattedBalance = (Number(balance) / Math.pow(10, 6)).toFixed(6);
      setUsdcBalance(formattedBalance);
    } catch (error) {
      console.error("Erreur lecture balance USDC:", error);
    }
  };

  const getQuote = async () => {
    if (!fromAmount || !address) return;

    setLoading(true);
    setError(null);

    try {
      // Convertir en wei pour ETH (18 decimales)
      const amountWei = (parseFloat(fromAmount) * Math.pow(10, 18)).toString();

      const params = new URLSearchParams({
        src: TOKENS.ETH,
        dst: TOKENS.USDC,
        amount: amountWei,
        slippage: slippage.toString(),
      });

      const response = await fetch(`${API_BASE}/oneinch/quote?${params}`);

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.statusText}`);
      }

      const quoteData: SwapQuote = await response.json();
      setQuote(quoteData);

      // Convertir le montant reçu (USDC a 6 decimales)
      const receivedAmount = parseInt(quoteData.toAmount) / Math.pow(10, 6);
      setToAmount(receivedAmount.toFixed(6));
    } catch (err) {
      console.error("Erreur quote:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la récupération du quote"
      );
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!fromAmount || !address || !walletClient || !isAuthenticated) {
      setError("Wallet non connecté ou données manquantes");
      return;
    }

    const token = authService.getToken();
    if (!token) {
      setError("Token d'authentification manquant");
      return;
    }

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Convertir en wei
      const amountWei = (parseFloat(fromAmount) * Math.pow(10, 18)).toString();

      const params = new URLSearchParams({
        src: TOKENS.ETH,
        dst: TOKENS.USDC,
        amount: amountWei,
        from: address,
        slippage: slippage.toString(),
      });

      const response = await fetch(`${API_BASE}/oneinch/swap?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.statusText}`);
      }

      const swapData: SwapQuote = await response.json();

      // Estimer le gas si pas fourni ou égal à 0
      let gasLimit = BigInt(300000); // Gas par défaut

      if (swapData.tx.gas && swapData.tx.gas !== "0") {
        gasLimit = BigInt(swapData.tx.gas);
      } else if (publicClient) {
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: address,
            to: swapData.tx.to as `0x${string}`,
            data: swapData.tx.data as `0x${string}`,
            value: BigInt(swapData.tx.value),
          });
          gasLimit = estimatedGas + BigInt(50000); // Ajouter une marge
        } catch (gasError) {
          console.warn("Gas estimation failed, using default:", gasError);
        }
      }

      const hash = await walletClient.sendTransaction({
        to: swapData.tx.to as `0x${string}`,
        data: swapData.tx.data as `0x${string}`,
        value: BigInt(swapData.tx.value),
        gas: gasLimit,
      });

      setTxHash(hash);

      // Vérifier la balance USDC après le swap
      setTimeout(() => {
        checkUsdcBalance();
      }, 3000);
    } catch (err) {
      console.error("Erreur swap:", err);
      setError(err instanceof Error ? err.message : "Erreur lors du swap");
    } finally {
      setLoading(false);
    }
  };

  // Auto-update quote quand le montant change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount && parseFloat(fromAmount) > 0) {
        getQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fromAmount, slippage]);

  // Vérifier la balance USDC au chargement
  useEffect(() => {
    if (address && publicClient) {
      checkUsdcBalance();
    }
  }, [address, publicClient]);

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Swap ETH → USDC</h2>

      {/* Balance USDC */}
      <div className="mb-4 p-3 bg-green-50 rounded-lg">
        <p className="text-sm text-gray-600">Balance USDC:</p>
        <p className="text-lg font-semibold text-green-700">
          {usdcBalance} USDC
        </p>
        <Button
          onClick={checkUsdcBalance}
          size="sm"
          variant="outline"
          className="mt-2"
        >
          🔄 Actualiser
        </Button>
      </div>

      <div className="space-y-4">
        {/* From Token */}
        <div>
          <label className="block text-sm font-medium mb-2">From (ETH)</label>
          <Input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            min="0"
            step="0.001"
          />
        </div>

        {/* To Token */}
        <div>
          <label className="block text-sm font-medium mb-2">To (USDC)</label>
          <Input
            type="text"
            value={toAmount}
            readOnly
            placeholder="0.0"
            className="bg-gray-50"
          />
        </div>

        {/* Slippage */}
        <div>
          <label className="block text-sm font-medium mb-2">Slippage (%)</label>
          <Input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            placeholder="1"
            min="0.1"
            max="50"
            step="0.1"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Success Display */}
        {txHash && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            Transaction envoyée: {txHash.slice(0, 10)}...
            <a
              href={`https://etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline"
            >
              Voir sur Etherscan
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={getQuote}
            disabled={!fromAmount || loading}
            className="w-full"
            variant="outline"
          >
            {loading ? "Chargement..." : "Actualiser Quote"}
          </Button>

          <Button
            onClick={executeSwap}
            disabled={
              !quote || !fromAmount || loading || !address || !isAuthenticated
            }
            className="w-full"
          >
            {loading ? "Swap en cours..." : "Swap"}
          </Button>
        </div>

        {/* Wallet Status */}
        {!address && (
          <p className="text-center text-gray-500 text-sm">
            Connectez votre wallet pour continuer
          </p>
        )}

        {address && !isAuthenticated && (
          <p className="text-center text-orange-500 text-sm">
            Authentification en cours...
          </p>
        )}
      </div>
    </Card>
  );
};
