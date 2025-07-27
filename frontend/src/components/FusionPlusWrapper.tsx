import React from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import FusionPlus from './FusionPlus';

/**
 * Wrapper pour FusionPlus qui gère les hooks AppKit
 */
const FusionPlusWrapper: React.FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  // Ne pas afficher le composant si pas connecté
  if (!isConnected || !address) {
    return (
      <div style={{
        padding: '20px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        margin: '10px 0',
        textAlign: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <h3 style={{ color: '#6b7280', margin: '0 0 8px 0' }}>
          ⚡ 1inch Fusion+ Integration
        </h3>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
          Connectez votre wallet pour accéder à Fusion+
        </p>
      </div>
    );
  }

  // Si pas de provider, afficher un message d'information
  if (!walletProvider) {
    return (
      <div style={{
        padding: '20px',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        margin: '10px 0',
        backgroundColor: '#fef3c7'
      }}>
        <h3 style={{ color: '#d97706', margin: '0 0 8px 0' }}>
          ⚡ 1inch Fusion+ Integration
        </h3>
        <p style={{ color: '#d97706', margin: 0, fontSize: '14px' }}>
          Provider en cours de chargement...
        </p>
      </div>
    );
  }

  return (
    <FusionPlus 
      provider={walletProvider} 
      userAddress={address} 
    />
  );
};

export default FusionPlusWrapper;