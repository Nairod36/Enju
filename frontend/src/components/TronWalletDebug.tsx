import React, { useEffect } from 'react';
import { useTronWallet } from '@/hooks/useTronWallet';
import { Button } from './ui/button';

export function TronWalletDebug() {
  const { 
    address, 
    isConnected, 
    balance, 
    isLoading, 
    error,
    connectTronWallet, 
    disconnectTronWallet,
    isInstalled,
  } = useTronWallet();

  useEffect(() => {
    console.log('🔍 TronWallet Debug State:', {
      address,
      isConnected,
      balance,
      isLoading,
      error,
      isInstalled,
      tronLink: !!window.tronLink,
      tronWeb: !!window.tronWeb,
      tronWebAddress: window.tronWeb?.defaultAddress?.base58,
    });
  }, [address, isConnected, balance, isLoading, error, isInstalled]);

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-bold mb-3">🔴 TRON Wallet Debug</h3>
      
      <div className="space-y-2 text-sm mb-4">
        <div><strong>Installed:</strong> {isInstalled ? '✅' : '❌'}</div>
        <div><strong>Connected:</strong> {isConnected ? '✅' : '❌'}</div>
        <div><strong>Loading:</strong> {isLoading ? '🔄' : '✅'}</div>
        <div><strong>Address:</strong> {address || 'None'}</div>
        <div><strong>Balance:</strong> {balance ? `${balance} TRX` : 'N/A'}</div>
        <div><strong>Error:</strong> {error || 'None'}</div>
      </div>

      <div className="space-y-2 text-xs mb-4 text-gray-600">
        <div><strong>window.tronLink:</strong> {window.tronLink ? '✅' : '❌'}</div>
        <div><strong>window.tronWeb:</strong> {window.tronWeb ? '✅' : '❌'}</div>
        <div><strong>tronWeb.defaultAddress:</strong> {window.tronWeb?.defaultAddress?.base58 || 'None'}</div>
      </div>

      <div className="flex gap-2">
        {!isConnected ? (
          <Button onClick={connectTronWallet} disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Connect TRON'}
          </Button>
        ) : (
          <Button onClick={disconnectTronWallet} variant="outline">
            Disconnect
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}