import React from 'react';
import { Button } from './ui/button';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Wallet, LogOut } from 'lucide-react';

export function CustomWalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  const handleConnect = async () => {
    try {
      await open();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (!isConnected || !address) {
    return (
      <Button
        onClick={handleConnect}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border-emerald-200 text-emerald-700 hover:text-emerald-800"
      >
        <Wallet size={16} />
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-sm font-mono text-emerald-700">
          {formatAddress(address)}
        </span>
      </div>
      <Button
        onClick={handleDisconnect}
        variant="ghost"
        size="sm"
        className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full p-2"
        title="Disconnect"
      >
        <LogOut size={14} />
      </Button>
    </div>
  );
}