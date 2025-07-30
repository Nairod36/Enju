import { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';

interface NearWalletState {
  accountId: string | null;
  isConnected: boolean;
  balance: string | null;
  isLoading: boolean;
}

const NETWORK_ID = 'testnet';
const CONTRACT_NAME = 'matthias-dev.testnet';

// Configure NEAR connection
const nearConfig = {
  networkId: NETWORK_ID,
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://testnet.mynearwallet.com/',
  helperUrl: 'https://helper.testnet.near.org',
  explorerUrl: 'https://testnet.nearblocks.io',
};

export function useNearWallet() {
  const [walletState, setWalletState] = useState<NearWalletState>({
    accountId: null,
    isConnected: false,
    balance: null,
    isLoading: false,
  });

  const [wallet, setWallet] = useState<any>(null);
  const [near, setNear] = useState<any>(null);

  useEffect(() => {
    initNear();
  }, []);

  const initNear = async () => {
    try {
      setWalletState(prev => ({ ...prev, isLoading: true }));

      // Initialize keystore
      const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();

      // Initialize NEAR connection
      const nearConnection = await nearAPI.connect({
        ...nearConfig,
        keyStore,
      });

      // Initialize wallet connection
      const walletConnection = new nearAPI.WalletConnection(nearConnection, 'enju-bridge');

      setNear(nearConnection);
      setWallet(walletConnection);

      // Check if user is already signed in
      if (walletConnection.isSignedIn()) {
        const accountId = walletConnection.getAccountId();
        await loadAccountData(nearConnection, accountId);
      }

      setWalletState(prev => ({ 
        ...prev, 
        isLoading: false,
        isConnected: walletConnection.isSignedIn(),
        accountId: walletConnection.isSignedIn() ? walletConnection.getAccountId() : null
      }));

    } catch (error) {
      console.error('Failed to initialize NEAR:', error);
      setWalletState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadAccountData = async (nearConnection: any, accountId: string) => {
    try {
      const account = await nearConnection.account(accountId);
      const balance = await account.getAccountBalance();
      const balanceInNear = nearAPI.utils.format.formatNearAmount(balance.available);
      
      setWalletState(prev => ({
        ...prev,
        balance: parseFloat(balanceInNear).toFixed(4)
      }));
    } catch (error) {
      console.error('Failed to load account data:', error);
    }
  };

  const connectWallet = async () => {
    if (!wallet) return;
    
    setWalletState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Request sign in
      await wallet.requestSignIn({
        contractId: CONTRACT_NAME,
        methodNames: [], // Add specific method names if needed
        successUrl: window.location.href,
        failureUrl: window.location.href,
      });
    } catch (error) {
      console.error('Failed to connect NEAR wallet:', error);
      setWalletState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const disconnectWallet = async () => {
    if (!wallet) return;
    
    try {
      wallet.signOut();
      setWalletState({
        accountId: null,
        isConnected: false,
        balance: null,
        isLoading: false,
      });
      
      // Reload the page to clear any cached state
      window.location.reload();
    } catch (error) {
      console.error('Failed to disconnect NEAR wallet:', error);
    }
  };

  const formatAccountId = (accountId: string) => {
    if (accountId.length <= 20) return accountId;
    return `${accountId.substring(0, 8)}...${accountId.substring(accountId.length - 8)}`;
  };

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    formatAccountId,
    wallet,
    near,
  };
}