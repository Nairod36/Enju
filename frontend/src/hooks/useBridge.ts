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
  fromChain: 'ethereum' | 'near' | 'tron';
  toChain: 'ethereum' | 'near' | 'tron';
  nearAccount?: string;
  tronAddress?: string;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const executeBridge = useCallback(async (params: BridgeParams): Promise<BridgeResult> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }
    
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { fromAmount, fromChain, toChain, nearAccount, tronAddress } = params;

      // ETH bridges
      if (fromChain === 'ethereum' && toChain === 'near') {
        return await bridgeEthToNear(fromAmount, nearAccount || 'user.testnet');
      } else if (fromChain === 'ethereum' && toChain === 'tron') {
        return await bridgeEthToTron(fromAmount, tronAddress || '');
      }
      // NEAR bridges  
      else if (fromChain === 'near' && toChain === 'ethereum') {
        return await bridgeNearToEth(fromAmount);
      }
      // TRON bridges (only to ETH)
      else if (fromChain === 'tron' && toChain === 'ethereum') {
        return await bridgeTronToEth(fromAmount);
      } else {
        throw new Error('Invalid bridge direction. Supported: ETH↔NEAR, ETH↔TRON');
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

  const bridgeEthToTron = async (amount: string, tronAddress: string): Promise<BridgeResult> => {
    try {
      console.log('Bridging ETH to TRON:', { amount, tronAddress });
      
      // Call backend API for ETH to TRON bridge
      const response = await fetch('/api/bridge/eth-to-tron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          tronAddress,
          ethAddress: address
        })
      });

      if (!response.ok) {
        throw new Error('ETH to TRON bridge failed');
      }

      const result = await response.json();
      return { success: true, txHash: result.txHash };
    } catch (error) {
      console.error('ETH to TRON bridge failed:', error);
      throw error;
    }
  };


  const bridgeTronToEth = async (amount: string): Promise<BridgeResult> => {
    try {
      console.log('Bridging TRON to ETH:', { amount, ethAddress: address });
      
      const response = await fetch('/api/bridge/tron-to-eth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          ethAddress: address,
          tronAddress: 'TR...' // Get from TRON wallet
        })
      });

      if (!response.ok) {
        throw new Error('TRON to ETH bridge failed');
      }

      const result = await response.json();
      return { success: true, txHash: result.txHash };
    } catch (error) {
      console.error('TRON to ETH bridge failed:', error);
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