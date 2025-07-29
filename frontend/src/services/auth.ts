import { signMessage } from '@wagmi/core';
import { wagmiAdapter } from '../config';

const API_BASE_URL = 'http://localhost:3001/api/v1';

export interface ConnectWalletRequest {
  walletAddress: string;
  signature: string;
  message: string;
  chainId?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: {
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
  };
  isNewUser: boolean;
}

export interface NonceResponse {
  message: string;
  nonce: string;
}

class AuthService {
  private token: string | null = null;
  private connectingWallet: string | null = null;
  private lastSignedMessage: string | null = null;
  private lastSignature: string | null = null;
  private lastConnectTime: number = 0;
  private cachedNonce: { walletAddress: string; message: string; timestamp: number } | null = null;

  async connectWallet(walletAddress: string, chainId?: number): Promise<AuthResponse> {
    const now = Date.now();
    
    // Éviter les appels trop rapides (moins de 3 secondes)
    if (now - this.lastConnectTime < 3000) {
      if (this.lastSignature && this.lastSignedMessage) {
        throw new Error('Please wait before reconnecting');
      }
    }
    
    // Éviter les appels concurrents pour la même adresse
    if (this.connectingWallet === walletAddress) {
      throw new Error('Connection already in progress for this wallet');
    }
    
    // Si on change de wallet, reset la connexion précédente
    if (this.connectingWallet && this.connectingWallet !== walletAddress) {
      this.connectingWallet = null;
    }
    
    this.connectingWallet = walletAddress;
    this.lastConnectTime = now;
    try {
      // 1. Get nonce from API (avec cache)
      let message: string;
      
      if (this.cachedNonce && 
          this.cachedNonce.walletAddress === walletAddress && 
          now - this.cachedNonce.timestamp < 10000) { // Cache pendant 10 secondes
        message = this.cachedNonce.message;
      } else {
        const nonceResponse = await fetch(`${API_BASE_URL}/users/nonce`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ walletAddress }),
        });
        
        if (!nonceResponse.ok) {
          throw new Error('Failed to get nonce');
        }

        const nonceData: NonceResponse = await nonceResponse.json();
        message = nonceData.message;
        
        // Mettre en cache
        this.cachedNonce = {
          walletAddress,
          message,
          timestamp: now
        };
      }

      // 2. Sign message with wallet (avec cache pour éviter les doubles signatures)
      let signature: string;
      if (this.lastSignedMessage === message && this.lastSignature) {
        signature = this.lastSignature;
      } else {
        signature = await signMessage(wagmiAdapter.wagmiConfig, {
          message,
        });
        this.lastSignedMessage = message;
        this.lastSignature = signature;
      }

      // 3. Send signature to API
      const connectRequest: ConnectWalletRequest = {
        walletAddress,
        signature,
        message,
        chainId,
      };

      const connectResponse = await fetch(`${API_BASE_URL}/users/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectRequest),
      });

      if (!connectResponse.ok) {
        throw new Error('Failed to connect wallet');
      }

      const authResponse: AuthResponse = await connectResponse.json();
      
      // Store token
      this.token = authResponse.accessToken;
      localStorage.setItem('auth_token', authResponse.accessToken);
      localStorage.setItem('user_data', JSON.stringify(authResponse.user));

      return authResponse;
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    } finally {
      this.connectingWallet = null;
    }
  }

  async getProfile() {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }

    if (!this.token) {
      throw new Error('No auth token');
    }

    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
        throw new Error('Token expired');
      }
      throw new Error('Failed to get profile');
    }

    const profile = await response.json();
    // Mettre à jour les données utilisateur en localStorage
    localStorage.setItem('user_data', JSON.stringify(profile));
    return profile;
  }

  logout() {
    this.token = null;
    this.lastSignedMessage = null;
    this.lastSignature = null;
    this.cachedNonce = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    // Nettoyer toutes les données liées à l'auth au cas où
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('auth_') || key.startsWith('user_')) {
        localStorage.removeItem(key);
      }
    });
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  getUserData() {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Helper method for authenticated API calls
  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No auth token available');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      this.logout();
      // Déclencher un événement pour que les hooks puissent réagir
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Token expired');
    }

    return response;
  }
}

export const authService = new AuthService();