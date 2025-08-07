
import { BRIDGE_CONFIG } from '@/config/networks';
import { useState, useEffect, useCallback } from 'react';

export interface PriceData {
  trxToEth: number;
  ethToTrx: number;
  nearToEth: number;
  ethToNear: number;
  timestamp: number;
  source: 'coingecko' | 'binance' | 'cache';
}

export interface ConversionResult {
  convertedAmount: string;
  exchangeRate: number;
  fromSymbol: string;
  toSymbol: string;
  isLoading: boolean;
  error: string | null;
}

const ORACLE_API_BASE = BRIDGE_CONFIG.listenerApi;

export function usePriceOracle() {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current prices
  const fetchPrices = useCallback(async (): Promise<PriceData | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${ORACLE_API_BASE}/api/prices`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPriceData(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(errorMessage);
      console.error('Price oracle error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convert amount between chains
  const convertAmount = useCallback(async (
    amount: string,
    fromChain: 'ethereum' | 'near' | 'tron',
    toChain: 'ethereum' | 'near' | 'tron'
  ): Promise<ConversionResult> => {
    const result: ConversionResult = {
      convertedAmount: '0',
      exchangeRate: 0,
      fromSymbol: fromChain.toUpperCase(),
      toSymbol: toChain.toUpperCase(),
      isLoading: true,
      error: null
    };

    if (fromChain === toChain) {
      return {
        ...result,
        convertedAmount: amount,
        exchangeRate: 1,
        isLoading: false
      };
    }

    try {
      const response = await fetch(`${ORACLE_API_BASE}/api/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          fromChain,
          toChain
        })
      });

      if (!response.ok) {
        throw new Error(`Conversion failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        ...result,
        convertedAmount: data.convertedAmount,
        exchangeRate: data.exchangeRate,
        isLoading: false
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Conversion failed';
      return {
        ...result,
        isLoading: false,
        error: errorMessage
      };
    }
  }, []);

  // Auto-fetch prices on mount and every 30 seconds
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return {
    priceData,
    isLoading,
    error,
    fetchPrices,
    convertAmount
  };
}

// Hook for real-time conversion with specific amount
export function useConversion(
  amount: string,
  fromChain: 'ethereum' | 'near' | 'tron',
  toChain: 'ethereum' | 'near' | 'tron'
) {
  const [conversionResult, setConversionResult] = useState<ConversionResult>({
    convertedAmount: '0',
    exchangeRate: 0,
    fromSymbol: fromChain.toUpperCase(),
    toSymbol: toChain.toUpperCase(),
    isLoading: false,
    error: null
  });

  const { convertAmount } = usePriceOracle();

  useEffect(() => {
    if (!amount || parseFloat(amount) === 0) {
      setConversionResult(prev => ({
        ...prev,
        convertedAmount: '0',
        exchangeRate: 0,
        isLoading: false,
        error: null
      }));
      return;
    }

    let cancelled = false;

    const performConversion = async () => {
      setConversionResult(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await convertAmount(amount, fromChain, toChain);

      if (!cancelled) {
        setConversionResult(result);
      }
    };

    // Debounce conversion requests
    const timeout = setTimeout(performConversion, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [amount, fromChain, toChain, convertAmount]);

  return conversionResult;
}