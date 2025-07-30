import React from 'react';
import { Button } from '@/components/ui/button';
import { useTronWallet } from '@/hooks/useTronWallet';

interface TronWalletButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function TronWalletButton({ className, size = 'default', variant = 'default' }: TronWalletButtonProps) {
  const { 
    address, 
    isConnected, 
    balance, 
    isLoading, 
    error,
    connectTronWallet, 
    disconnectTronWallet,
    isInstalled,
    formatBalance 
  } = useTronWallet();

  if (!isInstalled) {
    return (
      <Button
        variant="outline"
        size={size} 
        className={className}
        onClick={() => window.open('https://www.tronlink.org/', '_blank')}
      >
        <span className="text-red-500 mr-2">🔴</span>
        Install TronLink
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2" />
        Connecting...
      </Button>
    );
  }

  if (error) {
    return (
      <Button
        variant="destructive"
        size={size}
        className={className}
        onClick={connectTronWallet}
      >
        <span className="text-white mr-2">⚠️</span>
        Retry TRON
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse mr-2"></div>
          <div className="text-sm">
            <div className="font-mono text-red-700">
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </div>
            {balance && (
              <div className="text-xs text-red-600">
                {formatBalance(balance)} TRX
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnectTronWallet}
          className="text-red-600 hover:text-red-800"
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={connectTronWallet}
    >
      <span className="text-red-500 mr-2">🔴</span>
      Connect TRON
    </Button>
  );
}