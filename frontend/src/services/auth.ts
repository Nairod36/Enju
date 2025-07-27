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

  async connectWallet(walletAddress: string, chainId?: number): Promise<AuthResponse> {
    try {
      // 1. Get nonce from API
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

      const { message }: NonceResponse = await nonceResponse.json();

      // 2. Sign message with wallet
      const signature = await signMessage(wagmiAdapter.wagmiConfig, {
        message,
      });

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
      }
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
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
}

export const authService = new AuthService();