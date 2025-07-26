import React, { useState, useEffect } from "react";
import { SDK } from "@1inch/cross-chain-sdk";
import type { ExternalProvider } from "@ethersproject/providers";

// Utiliser le proxy local pour éviter les problèmes CORS
const FUSION_PLUS_API_URL = process.env.NODE_ENV === 'production' 
  ? "http://localhost:8080"  // Via proxy Nginx en production
  : "https://api.1inch.dev/fusion-plus";  // Direct en développement

/**
 * Créer une instance du SDK Cross-Chain pour Fusion+
 */
const createFusionPlusSDK = () => {
  return new SDK({
    url: FUSION_PLUS_API_URL,
    authKey: import.meta.env.VITE_FUSION_AUTH_KEY,
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
      // Créer une instance du SDK
      const sdk = createFusionPlusSDK();
      
      // Récupérer les ordres actifs pour tester la connexion
      const orders = await sdk.getActiveOrders({ page: 1, limit: 5 });
      
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
          <p className="fusion-status" style={{ color: '#059669', fontWeight: 500 }}>
            ✅ Connecté à 1inch Fusion+
          </p>
          <p className="fusion-address" style={{ 
            color: '#6b7280', 
            fontSize: '12px', 
            fontFamily: 'monospace' 
          }}>
            Wallet: {userAddress}
          </p>
          
          <div className="active-orders">
            <h4 style={{ margin: '15px 0 8px 0', color: '#374151' }}>
              Ordres actifs ({activeOrders.length})
            </h4>
            {activeOrders.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {activeOrders.slice(0, 3).map((order, index) => (
                  <li key={index} className="order-item" style={{
                    background: '#f9fafb',
                    padding: '6px 10px',
                    margin: '4px 0',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    <small>
                      {order.orderHash?.slice(0, 10)}...
                      {order.orderHash?.slice(-8)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucun ordre actif trouvé</p>
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
