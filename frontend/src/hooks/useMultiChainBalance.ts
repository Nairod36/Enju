import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWalletSelector } from '@near-wallet-selector/react-hook';

interface MultiChainBalance {
    eth: {
        formatted: string;
        symbol: string;
        value: bigint;
        decimals: number;
    } | null;
    near: {
        formatted: string;
        symbol: string;
        value: string;
        decimals: number;
    } | null;
    tron: {
        formatted: string;
        symbol: string;
        value: string;
        decimals: number;
    } | null;
}

export function useMultiChainBalance() {
    const { address, chainId } = useAccount();
    const { signedAccountId: nearAccountId } = useWalletSelector();
    const [balances, setBalances] = useState<MultiChainBalance>({
        eth: null,
        near: null,
        tron: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch ETH balance
    const fetchEthBalance = async () => {
        if (!address) return null;
        try {
            // Use backend as proxy to avoid CORS issues
            const response = await fetch('http://localhost:3001/api/v1/rpc/eth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [address, 'latest'],
                    id: 1
                })
            });

            const result = await response.json();

            if (result.result) {
                const balanceWei = BigInt(result.result);
                const balanceEth = Number(balanceWei) / 1e18;
                return {
                    formatted: balanceEth.toFixed(4),
                    symbol: 'ETH',
                    value: balanceWei,
                    decimals: 18
                };
            } else {
                console.error('No result in ETH balance response:', result);
            }
        } catch (err) {
            console.error('Failed to fetch ETH balance:', err);
        }
        return null;
    };

    // Fetch NEAR balance
    const fetchNearBalance = async () => {
        if (!nearAccountId) return null;

        try {
            const response = await fetch('https://rpc.testnet.fastnear.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'query',
                    params: {
                        request_type: 'view_account',
                        finality: 'final',
                        account_id: nearAccountId
                    },
                    id: 1
                })
            });

            const result = await response.json();
            if (result.result && result.result.amount) {
                const balanceYocto = result.result.amount;
                const balanceNear = Number(balanceYocto) / 1e24;

                return {
                    formatted: balanceNear.toFixed(4),
                    symbol: 'NEAR',
                    value: balanceYocto,
                    decimals: 24
                };
            }
        } catch (err) {
            console.error('Failed to fetch NEAR balance:', err);
        }
        return null;
    };

    // Fetch TRON balance (placeholder for now)
    const fetchTronBalance = async () => {
        // TODO: Implement TRON balance fetching
        return {
            formatted: '0.0000',
            symbol: 'TRX',
            value: '0',
            decimals: 6
        };
    };

    const fetchAllBalances = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [ethBalance, nearBalance, tronBalance] = await Promise.all([
                fetchEthBalance(),
                fetchNearBalance(),
                fetchTronBalance()
            ]);

            setBalances({
                eth: ethBalance,
                near: nearBalance,
                tron: tronBalance
            });
        } catch (err) {
            console.error('Failed to fetch balances:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch balances');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllBalances();

        // Refresh balances every 15 seconds
        const interval = setInterval(fetchAllBalances, 15000);
        return () => clearInterval(interval);
    }, [address, nearAccountId, chainId]);

    return { balances, isLoading, error, refetch: fetchAllBalances };
}
