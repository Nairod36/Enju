import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useAccount } from 'wagmi';
import { useCustomBalance } from '../hooks/useCustomBalance';

interface MintResponse {
  success: boolean;
  data?: {
    txHash: string;
    blockNumber: number;
    amount: string;
    recipient: string;
    gasUsed: string;
    adminAddress: string;
  };
  message?: string;
  error?: string;
}

export const MintETHButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastMint, setLastMint] = useState<MintResponse | null>(null);
  const { address } = useAccount();
  const { balance, refetch } = useCustomBalance();

  const handleMintETH = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      console.log('🎯 Minting 0.1 ETH to:', address);
      
      const response = await fetch('http://localhost:3002/api/mint-eth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address
        })
      });

      const result: MintResponse = await response.json();
      
      if (result.success) {
        setLastMint(result);
        console.log('✅ Mint successful:', result);
        
        // Update balance after successful mint
        setTimeout(() => {
          refetch();
        }, 2000); // Wait 2 seconds for block confirmation
        
        alert(`🎉 Successfully minted 0.1 ETH!\nTx: ${result.data?.txHash}`);
      } else {
        console.error('❌ Mint failed:', result.error);
        alert(`❌ Mint failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Mint request failed:', error);
      alert('❌ Failed to mint ETH. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 mb-4">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">🎯 Test ETH Faucet</h3>
          <p className="text-sm text-gray-600 mb-4">
            Get 0.1 ETH for testing the bridge (Fork network only)
          </p>
        </div>

        <div className="flex flex-col items-center space-y-2">
          <div className="text-sm">
            <span className="font-mono">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet connected'}
            </span>
          </div>
          
          {balance && (
            <div className="text-sm text-gray-600">
              Current Balance: <span className="font-mono">{parseFloat(balance.formatted).toFixed(4)} ETH</span>
            </div>
          )}

          <Button 
            onClick={handleMintETH}
            disabled={loading || !address}
            className="w-full max-w-xs"
          >
            {loading ? '⏳ Minting...' : '💰 Get 0.1 ETH'}
          </Button>
        </div>

        {lastMint && lastMint.success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="text-sm font-semibold text-green-800 mb-2">✅ Last Mint Transaction</h4>
            <div className="text-xs space-y-1 text-green-700">
              <div><strong>Amount:</strong> {lastMint.data?.amount}</div>
              <div><strong>Block:</strong> #{lastMint.data?.blockNumber}</div>
              <div><strong>Gas Used:</strong> {lastMint.data?.gasUsed}</div>
              <div className="break-all">
                <strong>Tx Hash:</strong> 
                <span className="font-mono ml-1">{lastMint.data?.txHash}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          💡 This faucet works only on the fork network for testing purposes
        </div>
      </div>
    </Card>
  );
};
