import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';

interface BridgeResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

interface BridgeParams {
  fromAmount: string;
  fromChain: 'ethereum' | 'near';
  toChain: 'ethereum' | 'near';
  nearAccount?: string;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const executeBridge = useCallback(async (params: BridgeParams): Promise<BridgeResult> => {
    if (!isConnected || !address || !walletClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { fromAmount, fromChain, toChain, nearAccount } = params;

      if (fromChain === 'ethereum' && toChain === 'near') {
        return await bridgeEthToNear(fromAmount, nearAccount || 'user.testnet');
      } else if (fromChain === 'near' && toChain === 'ethereum') {
        return await bridgeNearToEth(fromAmount);
      } else {
        throw new Error('Invalid bridge direction');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bridge failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, walletClient]);

  const bridgeEthToNear = async (amount: string, nearAccount: string): Promise<BridgeResult> => {
    try {
      // Bridge contract address (deployed address from the script output)
      const BRIDGE_ADDRESS = '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8';
      
      // Generate secret and hashlock for HTLC
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const hashlock = await crypto.subtle.digest('SHA-256', secret);
      const hashlockHex = '0x' + Array.from(new Uint8Array(hashlock))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Store secret locally (in real app, this would be handled securely)
      localStorage.setItem(`bridge_secret_${hashlockHex}`, Array.from(secret).join(','));

      // Call bridge contract
      const hash = await walletClient.writeContract({
        address: BRIDGE_ADDRESS as `0x${string}`,
        abi: [
          {
            name: 'createSwap',
            type: 'function',
            inputs: [
              { name: 'hashlock', type: 'bytes32' },
              { name: 'nearAccount', type: 'string' }
            ],
            outputs: [{ name: 'swapId', type: 'bytes32' }]
          }
        ],
        functionName: 'createSwap',
        args: [hashlockHex as `0x${string}`, nearAccount],
        value: parseEther(amount)
      });

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      console.log('✅ ETH to NEAR swap created:', {
        txHash: hash,
        hashlock: hashlockHex,
        nearAccount,
        amount
      });

      return { success: true, txHash: hash };
    } catch (error) {
      console.error('ETH to NEAR bridge failed:', error);
      throw error;
    }
  };

  const bridgeNearToEth = async (amount: string): Promise<BridgeResult> => {
    try {
      // This would integrate with NEAR wallet and contracts
      // For now, return a placeholder
      
      console.log('Bridging NEAR to ETH:', amount);
      
      // Simulate API call to NEAR contract
      const response = await fetch('/api/bridge/near-to-eth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          ethAddress: address
        })
      });

      if (!response.ok) {
        throw new Error('NEAR bridge failed');
      }

      const result = await response.json();
      return { success: true, txHash: result.txHash };
    } catch (error) {
      console.error('NEAR to ETH bridge failed:', error);
      throw error;
    }
  };

  return {
    executeBridge,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}