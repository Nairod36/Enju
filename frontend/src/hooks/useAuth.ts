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
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Load user from localStorage on mount
  useEffect(() => {
    const userData = authService.getUserData();
    const token = authService.getToken();
    
    if (userData && token) {
      setUser(userData);
      setIsAuthenticated(true);
    }
  }, []);

  // Handle wallet connection/disconnection
  useEffect(() => {
    if (isConnected && address && !isAuthenticated) {
      // Délai pour s'assurer que la connexion wallet est complète
      const timer = setTimeout(() => {
        handleWalletConnect();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!isConnected && isAuthenticated) {
      handleDisconnect();
    }
  }, [isConnected, address, isAuthenticated]);

  const handleWalletConnect = async () => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const response: AuthResponse = await authService.connectWallet(address, chainId);
      setUser(response.user);
      setIsAuthenticated(true);
      
      if (response.isNewUser) {
        console.log('Welcome new user!', response.user);
      } else {
        console.log('Welcome back!', response.user);
      }
    } catch (error) {
      console.error('Failed to authenticate:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
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