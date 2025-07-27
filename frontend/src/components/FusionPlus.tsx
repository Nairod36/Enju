import React, { useState, useEffect } from "react";
import { SDK } from "@1inch/cross-chain-sdk";
import { HashLock } from "@1inch/cross-chain-sdk";
import type { ExternalProvider } from "@ethersproject/providers";
import { FUSION_CONFIG } from "../config/fusion-near";


/**
 * Créer une instance du SDK Cross-Chain pour Fusion+
 */
const createFusionPlusSDK = () => {
  return new SDK({
    url: FUSION_CONFIG.apiUrl,
    authKey: FUSION_CONFIG.authKey,
  });
};

export interface FusionPlusProps {
  /** Le provider injecté / géré par Reown App Kit */
  provider: ExternalProvider;
  /** L'adresse connectée, issue de Reown App Kit */
  userAddress: string;
}

const FusionPlus: React.FC<FusionPlusProps> = ({ provider, userAddress }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [creatingOrder, setCreatingOrder] = useState<boolean>(false);
  const [sdkInstance, setSdkInstance] = useState<SDK | null>(null);

  // Réinitialise l'état quand le provider ou l'adresse changent
  useEffect(() => {
    if (!provider || !userAddress) {
      setIsConnected(false);
      setActiveOrders([]);
      setError("");
      return;
    }
  }, [provider, userAddress]);

  /**
   * Configure le SDK Fusion+ et récupère les ordres actifs
   */
  const handleConnectFusionPlus = async (): Promise<void> => {
    setLoading(true);
    setError("");
    
    try {
      // Vérifier la configuration
      if (!FUSION_CONFIG.authKey) {
        throw new Error("Clé API Fusion+ manquante. Vérifiez VITE_FUSION_AUTH_KEY.");
      }
      
      // Créer une instance du SDK
      const sdk = createFusionPlusSDK();
      setSdkInstance(sdk);
      
      // Récupérer les ordres actifs pour tester la connexion
      const orders = await sdk.getActiveOrders({ page: 1, limit: 10 });
      
      setActiveOrders(orders.items || []);
      setIsConnected(true);
      
    } catch (err: any) {
      console.error("Fusion+ connection error:", err);
      setError(err?.message ?? "Erreur lors de la connexion à Fusion+");
      setIsConnected(false);
      setActiveOrders([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Créer un ordre cross-chain de test
   */
  const handleCreateTestOrder = async (): Promise<void> => {
    if (!sdkInstance || !userAddress) return;
    
    setCreatingOrder(true);
    setError("");
    
    try {
      // Paramètres pour un ordre de test : ETH -> USDC cross-chain
      const quoteParams = {
        srcChainId: 1, // Ethereum
        dstChainId: 137, // Polygon
        srcTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
        dstTokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC sur Polygon
        amount: "10000000000000000", // 0.01 ETH en wei
        walletAddress: userAddress
      };
      
      // Obtenir un quote
      console.log("Requesting quote with params:", quoteParams);
      const quote = await sdkInstance.getQuote(quoteParams);
      console.log("Quote received:", quote);
      
      // Générer un secret et son hash pour l'ordre cross-chain
      const secret = "test_secret_" + Date.now();
      const secretHash = HashLock.hashSecret(secret);
      const secretHashes = [secretHash];
      
      // Créer un HashLock pour un seul fill
      const hashLock = HashLock.forSingleFill(secret);
      
      // Créer l'ordre
      const orderParams = {
        walletAddress: userAddress,
        hashLock,
        secretHashes,
        permit: undefined // Optionnel
      };
      
      const preparedOrder = sdkInstance.createOrder(quote, orderParams);
      console.log("Order created:", preparedOrder);
      
      // Rafraîchir la liste des ordres
      await handleConnectFusionPlus();
      
    } catch (err: any) {
      console.error("Order creation error:", err);
      setError(`Erreur création ordre: ${err?.message ?? "Erreur inconnue"}`);
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <div className="fusion-plus-auth" style={{
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      margin: '10px 0'
    }}>
      <h3>1inch Fusion+ Integration</h3>
      
      {!isConnected ? (
        <button
          onClick={handleConnectFusionPlus}
          
          className="fusion-button"
          style={{
            background: '#1f2937',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            opacity: (loading || !provider || !userAddress) ? 0.6 : 1
          }}
        >
          {loading
            ? "Connexion à Fusion+..."
            : "Se connecter à Fusion+"}
        </button>
      ) : (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <p className="fusion-status" style={{ color: '#059669', fontWeight: 500, margin: '0 0 4px 0' }}>
              ✅ Connecté à 1inch Fusion+
            </p>
            <p className="fusion-address" style={{ 
              color: '#6b7280', 
              fontSize: '12px', 
              fontFamily: 'monospace',
              margin: '0 0 8px 0'
            }}>
              Wallet: {userAddress}
            </p>
            <p style={{ 
              color: '#6b7280', 
              fontSize: '12px',
              margin: '0 0 12px 0'
            }}>
              API: {FUSION_CONFIG.apiUrl}
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={handleCreateTestOrder}
              disabled={creatingOrder || !sdkInstance}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px',
                opacity: (creatingOrder || !sdkInstance) ? 0.6 : 1
              }}
            >
              {creatingOrder ? "Création..." : "Créer ordre test ETH→USDC"}
            </button>
            
            <button
              onClick={handleConnectFusionPlus}
              disabled={loading}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? "Actualisation..." : "Actualiser ordres"}
            </button>
          </div>
          
          <div className="active-orders">
            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>
              Ordres actifs ({activeOrders.length})
            </h4>
            {activeOrders.length > 0 ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {activeOrders.map((order, index) => (
                  <div key={index} className="order-item" style={{
                    background: '#f9fafb',
                    padding: '8px 12px',
                    margin: '4px 0',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px'
                  }}>
                    <div style={{ fontFamily: 'monospace', marginBottom: '4px' }}>
                      Hash: {order.orderHash?.slice(0, 12)}...{order.orderHash?.slice(-8)}
                    </div>
                    {order.srcChainId && order.dstChainId && (
                      <div style={{ color: '#6b7280' }}>
                        Chaînes: {order.srcChainId} → {order.dstChainId}
                      </div>
                    )}
                    {order.makingAmount && (
                      <div style={{ color: '#6b7280' }}>
                        Montant: {order.makingAmount}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                Aucun ordre actif trouvé
              </p>
            )}
          </div>
        </div>
      )}
      
      {error && <p className="fusion-error" style={{ color: '#dc2626', fontSize: '14px' }}>
        ⚠️ {error}
      </p>}
    </div>
  );
};

export default FusionPlus;
