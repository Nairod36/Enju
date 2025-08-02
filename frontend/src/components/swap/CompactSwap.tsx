import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TokenSelector } from "./TokenSelector";
import { useAuth } from "../../hooks/useAuth";
import { useTokenBalances } from "../../hooks/useTokenBalances";
import { authService } from "../../services/auth";
import { ExternalLink, RotateCcw, Clock, Zap } from "lucide-react";

interface SwapQuote {
  dstAmount: string; // Changé de toAmount à dstAmount
  srcToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  dstToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  protocols: any[];
  gas: number;
  tx?: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

const TOKENS: Record<string, Token> = {
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
  },
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
  },
  REWARD: {
    address: "0x012EB96bcc36d3c32847dB4AC416B19Febeb9c54",
    symbol: "REWARD",
    name: "Enju Reward Token",
    decimals: 18,
  },
};

export const CompactSwap: React.FC = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { isAuthenticated } = useAuth();
  const { getTokenBalance } = useTokenBalances();

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<Token>(TOKENS.ETH);
  const [toToken, setToToken] = useState<Token>(TOKENS.USDC);
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Convertir les balances du hook en format attendu par TokenSelector
  const tokenBalances = Object.keys(TOKENS).reduce((acc, key) => {
    const token = TOKENS[key as keyof typeof TOKENS];
    const balance = getTokenBalance(token.address);
    acc[key] = balance ? balance.formatted : "0";
    return acc;
  }, {} as Record<string, string>);

  const API_BASE = process.env.VITE_API_URL || "http://localhost:3001/api/v1";

  const getQuote = async () => {
    if (!fromAmount || !address) return;

    setLoading(true);
    setError(null);

    try {
      const amountWei = (
        parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)
      ).toString();

      const params = new URLSearchParams({
        src: fromToken.address,
        dst: toToken.address,
        amount: amountWei,
        slippage: slippage.toString(),
      });

      const response = await fetch(`${API_BASE}/oneinch/quote?${params}`);

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.statusText}`);
      }

      const quoteData: SwapQuote = await response.json();
      console.log("Quote data received:", quoteData);
      console.log("Raw dstAmount:", quoteData.dstAmount);

      setQuote(quoteData);

      // Utiliser BigInt pour gérer les grandes valeurs en wei
      const receivedAmountWei = BigInt(quoteData.dstAmount);
      const receivedAmount =
        Number(receivedAmountWei) / Math.pow(10, toToken.decimals);

      console.log("Received amount wei:", receivedAmountWei.toString());
      console.log("Received amount formatted:", receivedAmount);

      setToAmount(receivedAmount.toFixed(toToken.decimals === 6 ? 2 : 4));
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
      const amountWei = (
        parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)
      ).toString();

      const params = new URLSearchParams({
        src: fromToken.address,
        dst: toToken.address,
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

      if (!swapData.tx) {
        throw new Error("Données de transaction manquantes dans la réponse");
      }

      let gasLimit = BigInt(300000);

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
          gasLimit = estimatedGas + BigInt(50000);
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
      setFromAmount("");
      setToAmount("");

      // Les balances se mettront à jour automatiquement via le hook
    } catch (err) {
      console.error("Erreur swap:", err);
      setError(err instanceof Error ? err.message : "Erreur lors du swap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount && parseFloat(fromAmount) > 0) {
        getQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fromAmount, slippage, fromToken, toToken]);

  // Les balances se mettent à jour automatiquement via le hook useTokenBalances

  const swapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount("");
    setToAmount("");
    setQuote(null);
  };

  return (
    <div className="space-y-4">
      {/* Main Swap Card - Compact - Même style que Bridge */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-slate-200 shadow-sm">
        <div className="space-y-4">
          {/* From Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From
            </label>
            <div className="space-y-2">
              <TokenSelector
                selectedToken={fromToken}
                onTokenSelect={setFromToken}
                tokens={TOKENS}
                balances={tokenBalances}
                excludeToken={toToken}
              />
              <Input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.001"
                className="text-lg"
              />
            </div>
          </div>

          {/* Swap Direction */}
          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={swapTokens}
              className="h-10 w-10 p-0 rounded-full border-2 hover:border-blue-300 hover:bg-blue-50"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* To Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
            </label>
            <div className="space-y-2">
              <TokenSelector
                selectedToken={toToken}
                onTokenSelect={setToToken}
                tokens={TOKENS}
                balances={tokenBalances}
                excludeToken={fromToken}
              />
              <Input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="bg-gray-50 text-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slippage (%)
            </label>
            <Input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              placeholder="1"
              min="0.1"
              max="50"
              step="0.1"
              className="w-24"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {txHash && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span>Swap réussi!</span>
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-green-600 hover:text-green-800"
                >
                  <span className="text-xs">Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Quote Info - Similar to Bridge */}
          {quote && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-slate-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="font-medium">Time</span>
                </span>
                <span className="font-bold text-slate-700">~15s</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-slate-600">
                  <Zap className="w-4 h-4 mr-1" />
                  <span className="font-medium">Network Fee</span>
                </span>
                <span className="font-bold text-blue-700">~$2-5</span>
              </div>
            </div>
          )}

          <Button
            onClick={executeSwap}
            disabled={
              !quote || !fromAmount || loading || !address || !isAuthenticated
            }
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
          >
            {loading
              ? "Swap en cours..."
              : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
          </Button>

          {!address && (
            <p className="text-center text-gray-500 text-sm">
              Connectez votre wallet pour continuer
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
