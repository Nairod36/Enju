import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { BRIDGE_CONFIG } from '@/config/networks';

export interface BridgeHistoryItem {
  id: string;
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH' | 'ETH_TO_TRON' | 'TRON_TO_ETH';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: string;
  fromChain: string;
  toChain: string;
  ethTxHash?: string;
  nearTxHash?: string;
  tronTxHash?: string;
  ethRecipient?: string;
  nearAccount?: string;
  tronAddress?: string;
  createdAt: number;
  completedAt?: number;
  hashlock: string;
  secret?: string;
}

export function useBridgeHistory() {
  const { address } = useAccount();
  const [bridges, setBridges] = useState<BridgeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBridgeHistory = async () => {
    if (!address) {
      setBridges([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
      const result = await response.json();

      if (result.success) {
        // Filter bridges for current user
        const userBridges = result.data.filter((bridge: any) => {
          // For ETH_TO_NEAR: check if the user initiated the ETH transaction
          if (bridge.type === 'ETH_TO_NEAR') {
            // In a real app, you'd track the initiator address
            // For now, we'll show all bridges as demo data
            return true;
          }
          
          // For NEAR_TO_ETH: check if ethRecipient matches current address
          if (bridge.type === 'NEAR_TO_ETH') {
            return bridge.ethRecipient?.toLowerCase() === address.toLowerCase();
          }
          
          // For ETH_TO_TRON: check if ethRecipient matches current address (user initiated from ETH)
          if (bridge.type === 'ETH_TO_TRON') {
            return bridge.ethRecipient?.toLowerCase() === address.toLowerCase();
          }
          
          // For TRON_TO_ETH: check if ethRecipient matches current address (user receives on ETH)
          if (bridge.type === 'TRON_TO_ETH') {
            return bridge.ethRecipient?.toLowerCase() === address.toLowerCase();
          }
          
          return false;
        }).map((bridge: any) => {
          let fromChain, toChain;
          
          switch (bridge.type) {
            case 'ETH_TO_NEAR':
              fromChain = 'ethereum';
              toChain = 'near';
              break;
            case 'NEAR_TO_ETH':
              fromChain = 'near';
              toChain = 'ethereum';
              break;
            case 'ETH_TO_TRON':
              fromChain = 'ethereum';
              toChain = 'tron';
              break;
            case 'TRON_TO_ETH':
              fromChain = 'tron';
              toChain = 'ethereum';
              break;
            default:
              fromChain = 'unknown';
              toChain = 'unknown';
          }
          
          return {
            id: bridge.id,
            type: bridge.type,
            status: bridge.status,
            amount: bridge.amount,
            fromChain,
            toChain,
            ethTxHash: bridge.ethTxHash,
            nearTxHash: bridge.nearTxHash,
            tronTxHash: bridge.tronTxHash,
            ethRecipient: bridge.ethRecipient,
            nearAccount: bridge.nearAccount,
            tronAddress: bridge.tronAddress,
            createdAt: bridge.createdAt,
            completedAt: bridge.completedAt,
            hashlock: bridge.hashlock,
            secret: bridge.secret,
          };
        });

        // Sort by creation date (newest first)
        userBridges.sort((a: BridgeHistoryItem, b: BridgeHistoryItem) => b.createdAt - a.createdAt);
        
        setBridges(userBridges);
      } else {
        setError('Failed to fetch bridge history');
      }
    } catch (err) {
      console.error('Error fetching bridge history:', err);
      setError('Network error while fetching bridge history');
      
      // Fallback: use mock data for demonstration
      setBridges(generateMockBridgeHistory(address));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshHistory = () => {
    fetchBridgeHistory();
  };

  useEffect(() => {
    fetchBridgeHistory();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBridgeHistory, 30000);
    return () => clearInterval(interval);
  }, [address]);

  return {
    bridges,
    isLoading,
    error,
    refreshHistory,
  };
}

// Mock data generator for demonstration
function generateMockBridgeHistory(address: string): BridgeHistoryItem[] {
  const now = Date.now();
  
  return [
    {
      id: 'eth_to_near_mock_1',
      type: 'ETH_TO_NEAR',
      status: 'COMPLETED',
      amount: '1000000000000000000', // 1 ETH in wei
      fromChain: 'ethereum',
      toChain: 'near',
      ethTxHash: '0x' + Math.random().toString(16).substring(2, 66),
      nearTxHash: Math.random().toString(16).substring(2, 44),
      ethRecipient: address,
      nearAccount: 'matthias-dev.testnet',
      createdAt: now - 2 * 60 * 60 * 1000, // 2 hours ago
      completedAt: now - 2 * 60 * 60 * 1000 + 45000, // 45 seconds later
      hashlock: '0x' + Math.random().toString(16).substring(2, 66),
    },
    {
      id: 'eth_to_near_mock_2',
      type: 'ETH_TO_NEAR',
      status: 'COMPLETED',
      amount: '500000000000000000', // 0.5 ETH in wei
      fromChain: 'ethereum',
      toChain: 'near',
      ethTxHash: '0x' + Math.random().toString(16).substring(2, 66),
      nearTxHash: Math.random().toString(16).substring(2, 44),
      ethRecipient: address,
      nearAccount: 'matthias-dev.testnet',
      createdAt: now - 24 * 60 * 60 * 1000, // 24 hours ago
      completedAt: now - 24 * 60 * 60 * 1000 + 52000, // 52 seconds later
      hashlock: '0x' + Math.random().toString(16).substring(2, 66),
    },
    {
      id: 'eth_to_near_mock_3',
      type: 'ETH_TO_NEAR',
      status: 'PENDING',
      amount: '300000000000000000', // 0.3 ETH in wei
      fromChain: 'ethereum',
      toChain: 'near',
      ethTxHash: '0x' + Math.random().toString(16).substring(2, 66),
      ethRecipient: address,
      nearAccount: 'matthias-dev.testnet',
      createdAt: now - 5 * 60 * 1000, // 5 minutes ago
      hashlock: '0x' + Math.random().toString(16).substring(2, 66),
    },
  ];
}