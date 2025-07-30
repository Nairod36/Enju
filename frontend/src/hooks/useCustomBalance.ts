import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface BalanceData {
  formatted: string;
  symbol: string;
  value: bigint;
  decimals: number;
}

export function useCustomBalance() {
  const { address, chainId } = useAccount();
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!address) {
        setBalance(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let rpcUrl = '';
        
        // Use fork RPC for mainnet chain ID (our fork)
        if (chainId === 1) {
          rpcUrl = 'http://vps-b11044fd.vps.ovh.net:8545/';
        } else {
          // For other networks, we might not have balance
          setBalance(null);
          setIsLoading(false);
          return;
        }

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });

        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message);
        }

        if (result.result) {
          const balanceWei = BigInt(result.result);
          const balanceEth = Number(balanceWei) / 1e18;
          
          setBalance({
            formatted: balanceEth.toString(),
            symbol: 'ETH',
            value: balanceWei,
            decimals: 18
          });
        }
      } catch (err) {
        console.error('Failed to fetch balance:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
        setBalance(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
    
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [address, chainId]);

  return { balance, isLoading, error };
}