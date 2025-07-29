import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { authService, AuthResponse } from '../services/auth';

export interface User {
  id: string;
  walletAddress: string;
  username?: string;
  level: number;
  experience: number;
  tokenBalance: number;
  activityScore: number;
  isConnected: boolean;
  lastLoginAt: string;
  lastActivityAt: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Load user from localStorage on mount and validate token
  useEffect(() => {
    const validateStoredAuth = async () => {
      const userData = authService.getUserData();
      const token = authService.getToken();
      
      if (userData && token) {
        setIsLoading(true);
        try {
          // Valider le token en faisant un appel API
          const profile = await authService.getProfile();
          setUser(profile);
          setIsAuthenticated(true);
        } catch (error) {
          // Token invalide, nettoyer et déconnecter
          authService.logout();
          setUser(null);
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
        }
      }
    };

    validateStoredAuth();
  }, []);

  // Listen for auth expiration events
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  // Handle wallet connection/disconnection
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !isLoading) {
      // Délai pour s'assurer que la connexion wallet est complète
      const timer = setTimeout(() => {
        handleWalletConnect();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!isConnected && isAuthenticated) {
      handleDisconnect();
    }
  }, [isConnected, address, isAuthenticated, isLoading]);


  const handleWalletConnect = async () => {
    if (!address || isLoading || isConnecting) {
      return;
    }
    
    setIsConnecting(true);
    setIsLoading(true);
    
    try {
      const response: AuthResponse = await authService.connectWallet(address, chainId);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to authenticate:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    if (!isAuthenticated) return;
    
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      localStorage.setItem('user_data', JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      handleDisconnect();
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    refreshProfile,
    disconnect: handleDisconnect,
  };
};