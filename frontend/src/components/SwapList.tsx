import React, { useState } from 'react';
import { SwapData, SwapListProps } from '../types/swap';

const SwapList: React.FC<SwapListProps> = ({ swaps }) => {
  const [expandedSwap, setExpandedSwap] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return '#007bff';
      case 'locked': return '#ffc107';
      case 'completed': return '#28a745';
      case 'expired': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'created': return '🆕';
      case 'locked': return '🔒';
      case 'completed': return '✅';
      case 'expired': return '⏰';
      default: return '❓';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (timelock: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = timelock - now;
    
    if (remaining <= 0) {
      return 'Expiré';
    }
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`;
    } else {
      return `${minutes}m restantes`;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copié dans le presse-papiers !`);
    });
  };

  if (swaps.length === 0) {
    return (
      <div style={{
        background: '#f8f9fa',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        border: '2px dashed #dee2e6'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
        <h3 style={{ color: '#6c757d', marginBottom: '8px' }}>Aucun swap créé</h3>
        <p style={{ color: '#9a9a9a', margin: 0 }}>
          Créez votre premier swap cross-chain pour commencer !
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ 
        color: '#495057',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        📋 Mes Swaps Cross-Chain 
        <span style={{
          background: '#007bff',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'normal'
        }}>
          {swaps.length}
        </span>
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        {swaps.map((swap) => (
          <div
            key={swap.id}
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              border: '2px solid #e9ecef',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Header du swap */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto',
              gap: '15px',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <div style={{
                background: getStatusColor(swap.status),
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {getStatusIcon(swap.status)} {swap.status.toUpperCase()}
              </div>
              
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px', color: '#495057' }}>
                  {swap.fromToken} → {swap.toToken}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  {swap.amount} {swap.fromToken}
                </div>
              </div>
              
              <div style={{ textAlign: 'right', fontSize: '14px' }}>
                <div style={{ color: '#495057', fontWeight: '600' }}>
                  {getTimeRemaining(swap.timelock)}
                </div>
                <div style={{ color: '#6c757d' }}>
                  Expire le {formatTime(swap.timelock)}
                </div>
              </div>
              
              <button
                onClick={() => setExpandedSwap(expandedSwap === swap.id ? null : swap.id)}
                style={{
                  background: '#f8f9fa',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#495057'
                }}
              >
                {expandedSwap === swap.id ? '▲ Masquer' : '▼ Détails'}
              </button>
            </div>
            
            {/* Informations principales */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: expandedSwap === swap.id ? '20px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                  DE (ETHEREUM)
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '14px',
                  background: '#f8f9fa',
                  padding: '8px',
                  borderRadius: '6px',
                  wordBreak: 'break-all'
                }}>
                  {swap.fromAddress}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                  VERS (NEAR)
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '14px',
                  background: '#f8f9fa',
                  padding: '8px',
                  borderRadius: '6px',
                  wordBreak: 'break-all'
                }}>
                  {swap.toAddress}
                </div>
              </div>
            </div>
            
            {/* Détails techniques (collapsible) */}
            {expandedSwap === swap.id && (
              <div style={{
                borderTop: '1px solid #dee2e6',
                paddingTop: '20px',
                marginTop: '20px'
              }}>
                <h4 style={{ 
                  color: '#495057', 
                  marginBottom: '15px',
                  fontSize: '16px'
                }}>
                  🔧 Détails techniques
                </h4>
                
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#495057',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🆔 ID du Swap
                      <button
                        onClick={() => copyToClipboard(swap.id, 'ID du swap')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📋 Copier
                      </button>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      background: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      wordBreak: 'break-all'
                    }}>
                      {swap.id}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#495057',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🔐 Secret (à garder privé !)
                      <button
                        onClick={() => copyToClipboard(swap.secret, 'Secret')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📋 Copier
                      </button>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      background: '#fff3cd',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ffeaa7',
                      wordBreak: 'break-all'
                    }}>
                      {swap.secret}
                    </div>
                    <small style={{ color: '#856404', fontSize: '12px' }}>
                      ⚠️ Ne partagez jamais ce secret ! Il est nécessaire pour récupérer vos fonds.
                    </small>
                  </div>
                  
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#495057',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      #️⃣ Hash du Secret
                      <button
                        onClick={() => copyToClipboard(swap.secretHash, 'Hash du secret')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📋 Copier
                      </button>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      background: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      wordBreak: 'break-all'
                    }}>
                      {swap.secretHash}
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '4px' }}>
                        ⏰ Timelock
                      </div>
                      <div style={{ fontSize: '13px', color: '#6c757d' }}>
                        {swap.timelock}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '4px' }}>
                        📅 Créé le
                      </div>
                      <div style={{ fontSize: '13px', color: '#6c757d' }}>
                        {new Date(swap.timestamp).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SwapList;