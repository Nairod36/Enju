import React from 'react';
import { SwapComponent } from '../../components/swap/SwapComponent';

export function SwapPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Swap Crypto
          </h1>
          <p className="text-lg text-gray-600">
            Échangez vos ETH contre USDC en utilisant 1inch
          </p>
        </div>
        
        <SwapComponent />
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informations</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Connectez votre wallet pour commencer</li>
            <li>• Les quotes sont automatiquement mis à jour</li>
            <li>• Slippage par défaut: 1%</li>
            <li>• Fonctionne avec le fork mainnet</li>
          </ul>
        </div>
      </div>
    </div>
  );
}