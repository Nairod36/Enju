import React, { useState } from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { getTokenAddress, parseEther } from '../utils/tokens';
import { SwapData, SwapCreatorProps, SwapFormData, SwapDirection } from '../types/swap';
import { fusionService } from '../services/fusionService';

const SwapCreator: React.FC<SwapCreatorProps> = ({ onSwapCreated }) => {
  const { address: userAddress } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  
  const [swapForm, setSwapForm] = useState<SwapFormData>({
    direction: 'eth-to-near',
    fromToken: 'ETH',
    toToken: 'NEAR',
    amount: '',
    nearAddress: '',
    ethAddress: '',
    timelock: '3600' // 1 heure par défaut
  });
  
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleDirectionChange = (newDirection: SwapDirection) => {
    setSwapForm(prev => ({
      ...prev,
      direction: newDirection,
      fromToken: newDirection === 'eth-to-near' ? 'ETH' : 'NEAR',
      toToken: newDirection === 'eth-to-near' ? 'NEAR' : 'ETH'
    }));
  };

  const createCrossChainSwap = async () => {
    const requiredAddress = swapForm.direction === 'eth-to-near' ? swapForm.nearAddress : swapForm.ethAddress;
    
    if (!swapForm.amount || !requiredAddress) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    if (!userAddress) {
      setError('Veuillez connecter votre wallet');
      return;
    }
    
    setCreating(true);
    setError('');
    
    try {
      if (!walletProvider) {
        throw new Error('Wallet provider non disponible');
      }

      console.log(`🚀 Création d'un swap ${swapForm.direction}...`);

      // Générer un secret unique pour ce swap via le service centralisé
      const { secret, secretHash } = fusionService.createSecret();
      
      // Calculer le timelock (timestamp futur en nanoseconds pour NEAR)
      const timelockSeconds = Math.floor(Date.now() / 1000) + parseInt(swapForm.timelock);
      const timelockNano = timelockSeconds * 1_000_000_000; // NEAR utilise des nanoseconds

      let swapData: SwapData;
      let orderId: string;

      if (swapForm.direction === 'eth-to-near') {
        // ETH → NEAR: Utiliser Fusion+ comme avant
        const quoteParams = {
          srcChainId: 1, // Ethereum mainnet
          dstChainId: 397, // NEAR (custom chain ID pour la démo)
          srcTokenAddress: getTokenAddress(swapForm.fromToken),
          dstTokenAddress: swapForm.nearAddress,
          amount: parseEther(swapForm.amount),
          walletAddress: userAddress
        };

        console.log('📊 Paramètres du quote ETH→NEAR:', quoteParams);

        const hashLock = fusionService.createHashLock(secret);
        
        const orderParams = {
          walletAddress: userAddress,
          hashLock,
          secretHashes: [secretHash],
          customParams: {
            targetChain: 'near',
            nearRecipient: swapForm.nearAddress,
            timelock: timelockNano,
            bridgeType: 'htlc'
          }
        };

        orderId = `fusion_order_${Date.now()}`;
        
        swapData = {
          id: orderId,
          fromChain: 'ethereum',
          toChain: 'near',
          fromToken: swapForm.fromToken,
          toToken: swapForm.toToken,
          amount: swapForm.amount,
          fromAddress: userAddress,
          toAddress: swapForm.nearAddress,
          secret: secret,
          secretHash: secretHash,
          timelock: timelockSeconds,
          status: 'fusion_created',
          timestamp: Date.now()
        };

        console.log('⚡ Ordre Fusion+ ETH→NEAR créé:', swapData);

        // Notifier le relayer pour ETH→NEAR
        try {
          await fetch('http://localhost:3001/webhook/fusion-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              secretHash,
              nearRecipient: swapForm.nearAddress,
              timelock: timelockNano,
              amount: swapData.amount,
              fromToken: swapData.fromToken,
              toToken: swapData.toToken,
              direction: 'eth-to-near'
            })
          });
          console.log('📡 Relayer notifié (ETH→NEAR)');
        } catch (webhookError) {
          console.warn('⚠️ Impossible de notifier le relayer:', webhookError);
        }

      } else {
        // NEAR → ETH: Initier depuis NEAR
        orderId = `near_swap_${Date.now()}`;
        
        swapData = {
          id: orderId,
          fromChain: 'near',
          toChain: 'ethereum',
          fromToken: swapForm.fromToken,
          toToken: swapForm.toToken,
          amount: swapForm.amount,
          fromAddress: swapForm.nearAddress,
          toAddress: swapForm.ethAddress,
          secret: secret,
          secretHash: secretHash,
          timelock: timelockSeconds,
          status: 'near_initiated',
          timestamp: Date.now()
        };

        console.log('⚡ Swap NEAR→ETH initié:', swapData);

        // Notifier le relayer pour NEAR→ETH
        try {
          await fetch('http://localhost:3001/webhook/near-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              secretHash,
              ethRecipient: swapForm.ethAddress,
              nearSender: swapForm.nearAddress,
              timelock: timelockNano,
              amount: swapData.amount,
              fromToken: swapData.fromToken,
              toToken: swapData.toToken,
              direction: 'near-to-eth'
            })
          });
          console.log('📡 Relayer notifié (NEAR→ETH)');
        } catch (webhookError) {
          console.warn('⚠️ Impossible de notifier le relayer:', webhookError);
        }
      }
      
      // Notifier le parent component
      onSwapCreated(swapData);
      
      // Réinitialiser le formulaire
      setSwapForm({
        direction: 'eth-to-near',
        fromToken: 'ETH',
        toToken: 'NEAR',
        amount: '',
        nearAddress: '',
        ethAddress: '',
        timelock: '3600'
      });
      
    } catch (err: any) {
      console.error('Swap creation error:', err);
      setError(`Erreur création swap: ${err?.message ?? 'Erreur inconnue'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setSwapForm(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  return (
    <div style={{
      background: '#f8f9fa',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '20px',
      border: '2px solid #e9ecef'
    }}>
      <h3 style={{ 
        marginTop: 0, 
        color: '#007bff',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        ⚡ Créer un Swap Cross-Chain
        <span style={{ fontSize: '14px', color: '#6c757d', fontWeight: 'normal' }}>
          {swapForm.direction === 'eth-to-near' ? 'Ethereum → NEAR' : 'NEAR → Ethereum'}
        </span>
      </h3>
      
      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Sélecteur de direction */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#495057'
          }}>
            Direction du swap
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '10px'
          }}>
            <button
              type="button"
              onClick={() => handleDirectionChange('eth-to-near')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: swapForm.direction === 'eth-to-near' ? '#007bff' : '#dee2e6',
                background: swapForm.direction === 'eth-to-near' ? '#e7f3ff' : 'white',
                color: swapForm.direction === 'eth-to-near' ? '#007bff' : '#495057',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              💎 ETH → 🌿 NEAR
            </button>
            <button
              type="button"
              onClick={() => handleDirectionChange('near-to-eth')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: swapForm.direction === 'near-to-eth' ? '#007bff' : '#dee2e6',
                background: swapForm.direction === 'near-to-eth' ? '#e7f3ff' : 'white',
                color: swapForm.direction === 'near-to-eth' ? '#007bff' : '#495057',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              🌿 NEAR → 💎 ETH
            </button>
          </div>
        </div>

        {/* Section From/To */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr auto 1fr', 
          gap: '15px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#495057'
            }}>
              Depuis ({swapForm.direction === 'eth-to-near' ? 'Ethereum' : 'NEAR'})
            </label>
            <select
              value={swapForm.fromToken}
              onChange={(e) => handleInputChange('fromToken', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '2px solid #dee2e6',
                fontSize: '16px',
                background: 'white'
              }}
            >
              {swapForm.direction === 'eth-to-near' ? (
                <>
                  <option value="ETH">💎 ETH</option>
                  <option value="USDC">💵 USDC</option>
                  <option value="USDT">💰 USDT</option>
                  <option value="WBTC">₿ WBTC</option>
                </>
              ) : (
                <>
                  <option value="NEAR">🌿 NEAR</option>
                  <option value="USDC.e">💵 USDC.e</option>
                  <option value="wETH">💎 wETH</option>
                </>
              )}
            </select>
          </div>
          
          <div style={{ 
            fontSize: '24px', 
            color: '#007bff',
            textAlign: 'center',
            padding: '10px'
          }}>
            →
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#495057'
            }}>
              Vers ({swapForm.direction === 'eth-to-near' ? 'NEAR' : 'Ethereum'})
            </label>
            <select
              value={swapForm.toToken}
              onChange={(e) => handleInputChange('toToken', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '2px solid #dee2e6',
                fontSize: '16px',
                background: 'white'
              }}
            >
              {swapForm.direction === 'eth-to-near' ? (
                <>
                  <option value="NEAR">🌿 NEAR</option>
                  <option value="USDC.e">💵 USDC.e</option>
                  <option value="wETH">💎 wETH</option>
                </>
              ) : (
                <>
                  <option value="ETH">💎 ETH</option>
                  <option value="USDC">💵 USDC</option>
                  <option value="USDT">💰 USDT</option>
                  <option value="WBTC">₿ WBTC</option>
                </>
              )}
            </select>
          </div>
        </div>
        
        {/* Montant */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#495057'
          }}>
            Montant à échanger
          </label>
          <input
            type="number"
            step="0.001"
            placeholder={`Ex: 0.5 ${swapForm.fromToken}`}
            value={swapForm.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '2px solid #dee2e6',
              fontSize: '16px'
            }}
          />
        </div>
        
        {/* Adresses conditionnelles */}
        {swapForm.direction === 'eth-to-near' ? (
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#495057'
            }}>
              Adresse NEAR de destination
            </label>
            <input
              type="text"
              placeholder="Ex: alice.near ou abc123...near"
              value={swapForm.nearAddress}
              onChange={(e) => handleInputChange('nearAddress', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '2px solid #dee2e6',
                fontSize: '16px'
              }}
            />
            <small style={{ color: '#6c757d', fontSize: '14px' }}>
              L'adresse qui recevra les tokens sur NEAR Protocol
            </small>
          </div>
        ) : (
          <>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Adresse NEAR source
              </label>
              <input
                type="text"
                placeholder="Ex: alice.near ou abc123...near"
                value={swapForm.nearAddress}
                onChange={(e) => handleInputChange('nearAddress', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '2px solid #dee2e6',
                  fontSize: '16px'
                }}
              />
              <small style={{ color: '#6c757d', fontSize: '14px' }}>
                L'adresse NEAR qui enverra les tokens
              </small>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Adresse Ethereum de destination
              </label>
              <input
                type="text"
                placeholder="Ex: 0x1234...abcd"
                value={swapForm.ethAddress}
                onChange={(e) => handleInputChange('ethAddress', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '2px solid #dee2e6',
                  fontSize: '16px'
                }}
              />
              <small style={{ color: '#6c757d', fontSize: '14px' }}>
                L'adresse Ethereum qui recevra les tokens
              </small>
            </div>
          </>
        )}
        
        {/* Durée d'expiration */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#495057'
          }}>
            Durée avant expiration
          </label>
          <select
            value={swapForm.timelock}
            onChange={(e) => handleInputChange('timelock', e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '2px solid #dee2e6',
              fontSize: '16px',
              background: 'white'
            }}
          >
            <option value="1800">⏱️ 30 minutes</option>
            <option value="3600">⏰ 1 heure</option>
            <option value="7200">🕐 2 heures</option>
            <option value="21600">🕕 6 heures</option>
            <option value="86400">📅 24 heures</option>
          </select>
        </div>
        
        {/* Messages d'erreur */}
        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #f5c6cb'
          }}>
            ⚠️ {error}
          </div>
        )}
        
        {/* Bouton de création */}
        <button
          onClick={createCrossChainSwap}
          disabled={creating || !userAddress}
          style={{
            background: creating ? '#6c757d' : 'linear-gradient(135deg, #007bff, #0056b3)',
            color: 'white',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '12px',
            cursor: creating ? 'not-allowed' : 'pointer',
            fontSize: '18px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: creating ? 'none' : '0 4px 15px rgba(0, 123, 255, 0.3)'
          }}
        >
          {creating ? (
            <span>🔄 Création en cours...</span>
          ) : (
            <span>⚡ Créer le Swap {swapForm.direction === 'eth-to-near' ? 'ETH→NEAR' : 'NEAR→ETH'}</span>
          )}
        </button>
        
        {!userAddress && (
          <div style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ffeaa7',
            textAlign: 'center'
          }}>
            🔗 Connectez votre wallet pour créer des swaps
          </div>
        )}
      </div>
    </div>
  );
};

export default SwapCreator;