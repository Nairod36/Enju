import React, { useState } from 'react';
import { Button } from './ui/button';
import { useTronWallet } from '@/hooks/useTronWallet';
import { BRIDGE_CONFIG } from '@/config/networks';

export function TronBridgeTest() {
  const { 
    address: tronAddress, 
    isConnected: tronConnected, 
    callContract: callTronContract,
    tronWeb,
    balance: tronBalance
  } = useTronWallet();

  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testTronContract = async () => {
    if (!tronConnected || !tronWeb) {
      setTestResult('❌ TRON wallet not connected');
      return;
    }

    setIsLoading(true);
    setTestResult('🔄 Testing TRON contract...');

    try {
      // Test 1: Check contract exists
      const contractAddress = BRIDGE_CONFIG.tron.contractAddress;
      const contract = await tronWeb.contract().at(contractAddress);
      setTestResult(prev => prev + '\n✅ Contract found at: ' + contractAddress);

      // Test 2: Check contract balance
      const contractBalance = await tronWeb.trx.getBalance(contractAddress);
      const balanceInTrx = tronWeb.fromSun(contractBalance);
      setTestResult(prev => prev + `\n💰 Contract balance: ${balanceInTrx} TRX`);

      // Test 3: Test a read-only function (if available)
      try {
        // This might fail if the function doesn't exist, that's ok
        const result = await contract.getOwner().call();
        setTestResult(prev => prev + '\n👤 Contract owner: ' + result);
      } catch (e) {
        setTestResult(prev => prev + '\n⚠️ Could not get owner (function might not exist)');
      }

      setTestResult(prev => prev + '\n\n🎯 Ready to test bridge functions!');

    } catch (error) {
      setTestResult(prev => prev + `\n❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCreateTronHTLC = async () => {
    if (!tronConnected || !tronWeb) {
      setTestResult('❌ TRON wallet not connected');
      return;
    }

    setIsLoading(true);
    setTestResult('🔄 Testing TRON HTLC creation...');

    try {
      const contractAddress = BRIDGE_CONFIG.tron.contractAddress;
      
      // Test parameters
      const testHashlock = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const testEthAddress = '0x742d35Cc6635C0532925a3b8D81Ca6b1f7Be5E18';
      const testAmount = '1'; // 1 TRX
      const testTimelock = Date.now() + 24 * 60 * 60 * 1000; // 24h from now

      const result = await callTronContract(
        contractAddress,
        'createTronBridge',
        [
          tronAddress, // receiver
          testHashlock.slice(2), // hashlock sans 0x
          testTimelock,
          testEthAddress // ethAddress
        ],
        {
          callValue: tronWeb.toSun(testAmount), // Amount in SUN
          feeLimit: 1000000000 // 1000 TRX fee limit
        }
      );

      setTestResult(prev => prev + '\n✅ TRON HTLC created successfully!');
      setTestResult(prev => prev + `\n📝 Transaction hash: ${result}`);

    } catch (error) {
      setTestResult(prev => prev + `\n❌ HTLC creation failed: ${error}`);
      console.error('TRON HTLC test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!tronConnected) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50">
        <h3 className="font-bold mb-3">🔴 TRON Bridge Test</h3>
        <p className="text-sm text-gray-600 mb-3">
          Connect your TRON wallet first to test bridge functions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-bold mb-3">🔴 TRON Bridge Test</h3>
      
      <div className="space-y-2 text-sm mb-4">
        <div><strong>TRON Address:</strong> {tronAddress}</div>
        <div><strong>Balance:</strong> {tronBalance} TRX</div>
        <div><strong>Contract:</strong> {BRIDGE_CONFIG.tron.contractAddress}</div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button 
          onClick={testTronContract} 
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? 'Testing...' : 'Test Contract'}
        </Button>
        
        <Button 
          onClick={testCreateTronHTLC} 
          disabled={isLoading}
          size="sm"
          variant="outline"
        >
          {isLoading ? 'Creating...' : 'Test HTLC'}
        </Button>
      </div>

      {testResult && (
        <div className="bg-black text-green-400 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
          {testResult}
        </div>
      )}
    </div>
  );
}