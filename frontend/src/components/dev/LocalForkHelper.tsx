/**
 * Local Fork Helper Component
 * 
 * A development helper component that displays information about connecting
 * to the local Ethereum mainnet fork and provides test account details.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Wallet, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  TEST_ACCOUNTS, 
  LOCAL_FORK_CONFIG, 
  checkAccountBalance,
  isConnectedToLocalFork,
  getMetaMaskInstructions 
} from '@/utils/localFork';

export const LocalForkHelper: React.FC = () => {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await isConnectedToLocalFork();
      setIsConnected(connected);
    };
    checkConnection();
  }, []);

  // Load account balances
  const loadBalances = async () => {
    setLoading(true);
    const newBalances: Record<string, string> = {};
    
    for (const account of TEST_ACCOUNTS) {
      try {
        const balance = await checkAccountBalance(account.address);
        newBalances[account.address] = balance;
      } catch (error) {
        newBalances[account.address] = 'Error';
      }
    }
    
    setBalances(newBalances);
    setLoading(false);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Connect to MetaMask network
  const connectToLocalFork = async () => {
    if (!window.ethereum) {
      alert('MetaMask not found. Please install MetaMask first.');
      return;
    }

    try {
      // Add the network to MetaMask
      await (window.ethereum as any).request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x1',
          chainName: LOCAL_FORK_CONFIG.name,
          rpcUrls: [LOCAL_FORK_CONFIG.rpcUrl],
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
        }],
      });

      // Switch to the network
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
      });

      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting to local fork:', error);
    }
  };

  const instructions = getMetaMaskInstructions();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Local Ethereum Fork - Development Helper
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            <span className={isConnected ? 'text-green-600' : 'text-yellow-600'}>
              {isConnected ? 'Connected to Local Fork' : 'Not connected to Local Fork'}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">🔗 Network Information</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>RPC URL:</span>
                <span className="font-mono">{LOCAL_FORK_CONFIG.rpcUrl}</span>
              </div>
              <div className="flex justify-between">
                <span>Chain ID:</span>
                <span>{LOCAL_FORK_CONFIG.chainId}</span>
              </div>
              <div className="flex justify-between">
                <span>Network:</span>
                <span>{LOCAL_FORK_CONFIG.name}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={connectToLocalFork} disabled={isConnected}>
              {isConnected ? 'Connected' : 'Connect to Local Fork'}
            </Button>
            <Button onClick={loadBalances} variant="outline" disabled={loading}>
              {loading ? 'Loading...' : 'Check Balances'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            Test Accounts (Each has 1000 ETH)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TEST_ACCOUNTS.map((account) => (
              <div key={account.address} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{account.name}</h4>
                  {balances[account.address] && (
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                      {balances[account.address]} ETH
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 min-w-[80px]">Address:</span>
                    <code className="text-xs bg-gray-100 p-1 rounded flex-1">
                      {account.address}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(account.address)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 min-w-[80px]">Private Key:</span>
                    <code className="text-xs bg-gray-100 p-1 rounded flex-1">
                      {account.privateKey}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(account.privateKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔧 MetaMask Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {instructions.instructions.map((instruction, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-400">{index + 1}.</span>
                <span>{instruction.replace(/^\d+\.\s*/, '')}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Quick Setup:</h4>
            <p className="text-sm text-blue-700">
              Import <strong>Test Account #0</strong> into MetaMask using the private key above, 
              then connect to your local fork. This account has 1000 ETH for testing swaps.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocalForkHelper;
