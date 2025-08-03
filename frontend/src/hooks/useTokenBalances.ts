import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface TokenBalance {
    formatted: string;
    value: bigint;
    decimals: number;
    symbol: string;
}

interface TokenBalanceMap {
    [address: string]: TokenBalance;
}

// Fonction utilitaire pour formater les unités
const formatUnits = (value: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals);
    const quotient = value / divisor;
    const remainder = value % divisor;
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const formattedRemainder = remainderStr.replace(/0+$/, '') || '0';
    return formattedRemainder === '0' ? quotient.toString() : `${quotient}.${formattedRemainder}`;
};

export function useTokenBalances() {
    const { address } = useAccount();
    const [balances, setBalances] = useState<TokenBalanceMap>({});
    const [isLoading, setIsLoading] = useState(false);

    const fetchTokenBalance = async (tokenAddress: string, decimals: number = 18): Promise<TokenBalance | null> => {
        if (!address) return null;

        try {
            // Handle ETH (native token)
            if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
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
                    return {
                        formatted: formatUnits(balanceWei, 18),
                        value: balanceWei,
                        decimals: 18,
                        symbol: 'ETH'
                    };
                }
            } else {
                // Handle ERC20 tokens - Try direct RPC for REWARD token, fallback to backend
                let rpcUrl = 'http://localhost:3001/api/v1/rpc/eth';
                let tryDirectRpc = tokenAddress === '0x012EB96bcc36d3c32847dB4AC416B19Febeb9c54';

                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [
                            {
                                to: tokenAddress,
                                data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}` // balanceOf(address)
                            },
                            'latest'
                        ],
                        id: 1
                    })
                });

                const result = await response.json();

                // If direct RPC failed and this is REWARD token, try backend as fallback
                if (tryDirectRpc && (!result.result || result.error)) {
                    console.log(`❌ Direct RPC failed for REWARD token, trying backend fallback...`);
                    const fallbackResponse = await fetch('http://localhost:3001/api/v1/rpc/eth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'eth_call',
                            params: [
                                {
                                    to: tokenAddress,
                                    data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}` // balanceOf(address)
                                },
                                'latest'
                            ],
                            id: 1
                        })
                    });
                    const fallbackResult = await fallbackResponse.json();

                    if (fallbackResult.result && fallbackResult.result !== '0x') {
                        const balance = BigInt(fallbackResult.result);
                        const formatted = formatUnits(balance, decimals);

                        return {
                            formatted,
                            value: balance,
                            decimals,
                            symbol: 'REWARD'
                        };
                    }
                }

                if (result.result && result.result !== '0x') {
                    const balance = BigInt(result.result);
                    const formatted = formatUnits(balance, decimals);

                    return {
                        formatted,
                        value: balance,
                        decimals,
                        symbol: tokenAddress === '0x012EB96bcc36d3c32847dB4AC416B19Febeb9c54' ? 'REWARD' : 'TOKEN'
                    };
                } else {
                    console.log(`⚠️ Token ${tokenAddress} has zero or invalid balance:`, result.result);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch balance for token ${tokenAddress}:`, error);
        }
        return null;
    };

    const getTokenBalance = (tokenAddress: string): TokenBalance | null => {
        return balances[tokenAddress] || null;
    };

    const refreshBalances = async () => {
        if (!address) {
            console.log('Missing address:', address);
            return;
        }
        setIsLoading(true);

        // Common token addresses
        const commonTokens = [
            { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, // ETH
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 }, // WETH
            { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },  // USDC
            { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },  // USDT
            { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 }, // DAI
            { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },  // WBTC
            { address: "0x012EB96bcc36d3c32847dB4AC416B19Febeb9c54", decimals: 18 }, // REWARD Token
        ];

        try {

            const balancePromises = commonTokens.map(async (token) => {
                const balance = await fetchTokenBalance(token.address, token.decimals);
                return { address: token.address, balance };
            });

            const results = await Promise.all(balancePromises);

            const newBalances: TokenBalanceMap = {};
            results.forEach(({ address: tokenAddress, balance }) => {
                if (balance) {
                    newBalances[tokenAddress] = balance;
                }
            });


            setBalances(newBalances);
        } catch (error) {
            console.error('Failed to refresh token balances:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshBalances();

        // Refresh balances every 30 seconds
        const interval = setInterval(refreshBalances, 5000);
        return () => clearInterval(interval);
    }, [address]);

    return {
        balances,
        isLoading,
        getTokenBalance,
        refreshBalances
    };
}