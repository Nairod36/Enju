import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useNearWallet } from '@/hooks/useNearWallet';
import { Wallet, ChevronDown, X } from 'lucide-react';

export function DualWalletButton() {
  const { address: ethAddress, isConnected: ethConnected } = useAccount();
  const { disconnect: disconnectEth } = useDisconnect();
  const { open } = useAppKit();
  
  const { 
    accountId: nearAccountId, 
    isConnected: nearConnected, 
    isLoading: nearLoading,
    connectWallet: connectNear, 
    disconnectWallet: disconnectNear,
    formatAccountId 
  } = useNearWallet();

  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleConnectEth = async () => {
    try {
      await open();
      setShowWalletModal(false);
    } catch (error) {
      console.error('ETH connection failed:', error);
    }
  };

  const formatEthAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleConnectNear = async () => {
    await connectNear();
    setShowWalletModal(false);
  };

  const bothConnected = ethConnected && nearConnected;
  const noneConnected = !ethConnected && !nearConnected;

  // Modal component avec portal
  const WalletModal = ({ title, children }: { title: string; children: React.ReactNode }) => {
    if (!showWalletModal) return null;
    
    return createPortal(
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
        style={{ zIndex: 9999 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowWalletModal(false);
          }
        }}
      >
        <div className="bg-white rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <Button
              onClick={() => setShowWalletModal(false)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X size={16} />
            </Button>
          </div>
          {children}
        </div>
      </div>,
      document.body
    );
  };

  // Orbiter Finance style - clean, minimal
  if (noneConnected) {
    return (
      <>
        <Button
          onClick={() => setShowWalletModal(true)}
          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium transition-all"
        >
          Connect Wallet
        </Button>

        <WalletModal title="Connect Wallet">
          <div className="space-y-3">
            {/* Ethereum Wallet */}
            <button
              onClick={handleConnectEth}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl">
                ⟠
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">Ethereum</div>
                <div className="text-sm text-gray-500">Connect with MetaMask or WalletConnect</div>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg] group-hover:text-gray-600" />
            </button>

            {/* NEAR Wallet */}
            <button
              onClick={handleConnectNear}
              disabled={nearLoading}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-xl">
                Ⓝ
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">NEAR Protocol</div>
                <div className="text-sm text-gray-500">
                  {nearLoading ? 'Connecting...' : 'Connect with NEAR Wallet'}
                </div>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg] group-hover:text-gray-600" />
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            Bridge requires both wallets to be connected
          </div>
        </WalletModal>
      </>
    );
  }

  // Connected state - Orbiter Finance style
  return (
    <div className="flex items-center gap-2">
      {/* ETH Wallet - Connected */}
      {ethConnected && ethAddress && (
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs">
            ⟠
          </div>
          <span className="text-sm font-mono text-gray-700">
            {formatEthAddress(ethAddress)}
          </span>
          <Button
            onClick={() => disconnectEth()}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 ml-1"
            title="Disconnect Ethereum"
          >
            <X size={12} />
          </Button>
        </div>
      )}

      {/* NEAR Wallet - Connected */}
      {nearConnected && nearAccountId && (
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs">
            Ⓝ
          </div>
          <span className="text-sm font-mono text-gray-700">
            {formatAccountId(nearAccountId)}
          </span>
          <Button
            onClick={disconnectNear}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 ml-1"
            title="Disconnect NEAR"
          >
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Connect missing wallet button */}
      {!bothConnected && (
        <Button
          onClick={() => setShowWalletModal(true)}
          variant="outline"
          size="sm"
          className="bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900"
        >
          <Wallet size={14} />
        </Button>
      )}

      {/* Modal for connecting missing wallet */}
      {!noneConnected && (
        <WalletModal title="Connect Additional Wallet">
          <div className="space-y-3">
            {!ethConnected && (
              <button
                onClick={handleConnectEth}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl">
                  ⟠
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">Ethereum</div>
                  <div className="text-sm text-gray-500">Connect with MetaMask</div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg] group-hover:text-gray-600" />
              </button>
            )}

            {!nearConnected && (
              <button
                onClick={handleConnectNear}
                disabled={nearLoading}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-xl">
                  Ⓝ
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">NEAR Protocol</div>
                  <div className="text-sm text-gray-500">
                    {nearLoading ? 'Connecting...' : 'Connect with NEAR Wallet'}
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg] group-hover:text-gray-600" />
              </button>
            )}
          </div>
        </WalletModal>
      )}
    </div>
  );
}