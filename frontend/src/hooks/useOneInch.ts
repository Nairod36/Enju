import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
}

interface WalletBalances {
  address: string;
  chainId: number;
  totalValueUsd: number;
  tokens: TokenBalance[];
  nativeToken: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
    priceUsd: number;
    valueUsd: number;
  };
}

interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
  chainId: number;
  isVerified: boolean;
}

interface SpotPrice {
  fromToken: TokenMetadata;
  toToken: TokenMetadata;
  fromAmount: string;
  toAmount: string;
  rate: number;
  timestamp: number;
}

interface UserStats {
  address: string;
  totalValueUsd: number;
  chainsCount: number;
  tokensCount: number;
  chains: WalletBalances[];
  topTokens: any[];
}

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001/api/v1'
  : 'https://api.yourdomain.com/api/v1';

export function useOneInch() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (endpoint: string, options?: RequestInit) => {
    try {
      const response = await fetch(`${API_BASE}/oneinch${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.accessToken ? `Bearer ${user.accessToken}` : '',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('1inch API call failed:', err);
      throw err;
    }
  }, [user?.accessToken]);

  // Get wallet balances for a specific chain
  const getWalletBalances = useCallback(async (
    address: string, 
    chainId: number = 1
  ): Promise<WalletBalances> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall(`/balances/${address}?chainId=${chainId}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet balances');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get multi-chain wallet balances
  const getMultiChainBalances = useCallback(async (
    address: string
  ): Promise<WalletBalances[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall(`/balances/${address}/multi-chain`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch multi-chain balances');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get token metadata
  const getTokenMetadata = useCallback(async (
    address: string, 
    chainId: number = 1
  ): Promise<TokenMetadata> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall(`/token/${address}?chainId=${chainId}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token metadata');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get spot price between tokens
  const getSpotPrice = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string,
    chainId: number = 1
  ): Promise<SpotPrice> => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        fromToken,
        toToken,
        amount,
        chainId: chainId.toString(),
      });
      
      const data = await apiCall(`/price?${params.toString()}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spot price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get supported tokens for a chain
  const getSupportedTokens = useCallback(async (
    chainId: number = 1
  ): Promise<TokenMetadata[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall(`/tokens?chainId=${chainId}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch supported tokens');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Convert amount between tokens
  const convertAmount = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string,
    chainId: number = 1
  ): Promise<{ fromAmount: string; toAmount: string; rate: number }> => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        fromToken,
        toToken,
        amount,
        chainId: chainId.toString(),
      });
      
      const data = await apiCall(`/convert?${params.toString()}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert amount');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get comprehensive user stats
  const getUserStats = useCallback(async (
    address: string
  ): Promise<UserStats> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall(`/stats/user/${address}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user stats');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Health check
  const healthCheck = useCallback(async (): Promise<{ status: string; api1inch: boolean }> => {
    try {
      const data = await apiCall('/health');
      return data;
    } catch (err) {
      return { status: 'unhealthy', api1inch: false };
    }
  }, [apiCall]);

  return {
    loading,
    error,
    getWalletBalances,
    getMultiChainBalances,
    getTokenMetadata,
    getSpotPrice,
    getSupportedTokens,
    convertAmount,
    getUserStats,
    healthCheck,
  };
}

// Hook for wallet balances with auto-refresh
export function useWalletBalances(address?: string, chainId: number = 1, refreshInterval: number = 30000) {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getWalletBalances } = useOneInch();

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getWalletBalances(address, chainId);
      setBalances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  }, [address, chainId, getWalletBalances]);

  useEffect(() => {
    fetchBalances();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchBalances, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchBalances, refreshInterval]);

  return {
    balances,
    loading,
    error,
    refetch: fetchBalances,
  };
}

// Hook for multi-chain portfolio
export function useMultiChainPortfolio(address?: string, refreshInterval: number = 60000) {
  const [portfolio, setPortfolio] = useState<WalletBalances[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getMultiChainBalances } = useOneInch();

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getMultiChainBalances(address);
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  }, [address, getMultiChainBalances]);

  useEffect(() => {
    fetchPortfolio();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPortfolio, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPortfolio, refreshInterval]);

  const totalValue = portfolio.reduce((sum, chain) => sum + chain.totalValueUsd, 0);
  const chainsCount = portfolio.length;
  const tokensCount = portfolio.reduce((sum, chain) => sum + chain.tokens.length, 0);

  return {
    portfolio,
    totalValue,
    chainsCount,
    tokensCount,
    loading,
    error,
    refetch: fetchPortfolio,
  };
}

// Hook for real-time prices
export function useSpotPrice(
  fromToken?: string,
  toToken?: string,
  amount: string = '1000000000000000000', // 1 ETH
  chainId: number = 1,
  refreshInterval: number = 10000
) {
  const [price, setPrice] = useState<SpotPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getSpotPrice } = useOneInch();

  const fetchPrice = useCallback(async () => {
    if (!fromToken || !toToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getSpotPrice(fromToken, toToken, amount, chainId);
      setPrice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, [fromToken, toToken, amount, chainId, getSpotPrice]);

  useEffect(() => {
    fetchPrice();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPrice, refreshInterval]);

  return {
    price,
    loading,
    error,
    refetch: fetchPrice,
  };
}