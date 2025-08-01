import { useState, useEffect, useCallback } from 'react';

// Extend window object to include TronWeb
declare global {
  interface Window {
    tronWeb?: any;
    tronLink?: any;
  }
}

interface TronWalletState {
  address: string | null;
  isConnected: boolean;
  balance: string | null;
  tronWeb: any | null;
  isLoading: boolean;
  error: string | null;
}

export function useTronWallet() {
  const [state, setState] = useState<TronWalletState>({
    address: null,
    isConnected: false,
    balance: null,
    tronWeb: null,
    isLoading: false,
    error: null,
  });

  // Check if TronLink is installed and initialize connection
  const checkTronLink = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if TronLink is installed
      if (!window.tronLink) {
        throw new Error('TronLink extension not found');
      }

      // Wait for TronWeb to be ready
      let attempts = 0;
      const maxAttempts = 30; // Reduced attempts

      const waitForTronWeb = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          const check = () => {
            attempts++;
            
            // Check if TronWeb is available and has default address
            if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
              resolve(window.tronWeb);
            } else if (window.tronWeb && !window.tronWeb.defaultAddress.base58) {
              // TronWeb exists but no account connected
              reject(new Error('Please unlock your TronLink wallet'));
            } else if (attempts >= maxAttempts) {
              reject(new Error('TronLink not ready. Please refresh and try again.'));
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      };

      const tronWeb = await waitForTronWeb();
      const address = tronWeb.defaultAddress.base58;

      // Verify the address format
      if (!address || !address.startsWith('T')) {
        throw new Error('Invalid TRON address format');
      }

      // Get balance with error handling
      let balanceInTrx = '0';
      try {
        const balanceInSun = await tronWeb.trx.getBalance(address);
        balanceInTrx = tronWeb.fromSun(balanceInSun).toString();
        console.log('🔍 TRON Wallet Balance Fetch:', {
          address,
          balanceInSun: balanceInSun?.toString(),
          balanceInTrx,
          timestamp: new Date().toISOString()
        });
      } catch (balanceError) {
        console.warn('Failed to fetch TRON balance:', balanceError);
        balanceInTrx = '0'; // Default to 0 if balance fetch fails
      }

      setState({
        address,
        isConnected: true,
        balance: balanceInTrx,
        tronWeb,
        isLoading: false,
        error: null,
      });

      console.log('🔴 TRON wallet connected:', { address, balance: balanceInTrx });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to TRON wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isConnected: false,
        address: null,
        balance: null,
        tronWeb: null,
      }));
      console.warn('⚠️ TRON wallet connection failed:', errorMessage);
    }
  }, []);

  // Connect to TronLink wallet
  const connectTronWallet = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if TronLink is installed
      if (!window.tronLink) {
        throw new Error('TronLink extension not found. Please install TronLink.');
      }

      // Try to request account access
      try {
        const result = await window.tronLink.request({ method: 'tron_requestAccounts' });
        
        if (result.code === 200) {
          // Wait a bit for TronLink to update
          setTimeout(() => checkTronLink(), 1000);
        } else {
          throw new Error(`Connection failed with code: ${result.code}`);
        }
      } catch (requestError) {
        console.warn('tron_requestAccounts failed, trying direct connection:', requestError);
        
        // Fallback: try direct connection
        await checkTronLink();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to TRON wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      console.error('❌ TRON wallet connection failed:', errorMessage);
    }
  }, [checkTronLink]);

  // Disconnect wallet
  const disconnectTronWallet = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      balance: null,
      tronWeb: null,
      isLoading: false,
      error: null,
    });
    console.log('🔴 TRON wallet disconnected');
  }, []);

  // Send transaction
  const sendTransaction = useCallback(async (toAddress: string, amount: string) => {
    if (!state.tronWeb || !state.isConnected) {
      throw new Error('TRON wallet not connected');
    }

    try {
      const tradeObj = await state.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        state.tronWeb.toSun(amount),
        state.address
      );

      const signedTxn = await state.tronWeb.trx.sign(tradeObj);
      const receipt = await state.tronWeb.trx.sendRawTransaction(signedTxn);

      return receipt;
    } catch (error) {
      console.error('❌ TRON transaction failed:', error);
      throw error;
    }
  }, [state.tronWeb, state.isConnected, state.address]);

  // Call smart contract method
  const callContract = useCallback(async (
    contractAddress: string,
    functionSelector: string,
    parameters: any[] = [],
    options: any = {}
  ) => {
    if (!state.tronWeb || !state.isConnected) {
      throw new Error('TRON wallet not connected');
    }

    try {
      const contract = await state.tronWeb.contract().at(contractAddress);
      const result = await contract[functionSelector](...parameters).send(options);
      
      return result;
    } catch (error) {
      console.error('❌ TRON contract call failed:', error);
      throw error;
    }
  }, [state.tronWeb, state.isConnected]);

  // Auto-check connection on mount and when TronLink changes
  useEffect(() => {
    checkTronLink();

    // Listen for account changes using TronWeb events (if available)
    const handleAccountsChanged = () => {
      console.log('🔄 TRON account changed, reconnecting...');
      setTimeout(checkTronLink, 1000); // Delay to let TronLink update
    };

    // Try different event listeners for TronLink
    if (window.tronLink) {
      // Method 1: Try addEventListener if available
      if (typeof window.tronLink.addEventListener === 'function') {
        window.tronLink.addEventListener('accountsChanged', handleAccountsChanged);
      }
      // Note: Removed tronWeb.eventServer.on() as it's not supported in current TronLink versions
    }

    // Polling fallback - check connection every 3 seconds
    const pollInterval = setInterval(() => {
      if (window.tronWeb && window.tronWeb.defaultAddress.base58 !== state.address) {
        handleAccountsChanged();
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (window.tronLink && typeof window.tronLink.removeEventListener === 'function') {
        window.tronLink.removeEventListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [checkTronLink, state.address]);

  return {
    // State
    address: state.address,
    isConnected: state.isConnected,
    balance: state.balance,
    tronWeb: state.tronWeb,
    isLoading: state.isLoading,
    error: state.error,

    // Actions  
    connectTronWallet,
    disconnectTronWallet,
    sendTransaction,
    callContract,
    
    // Utils
    isInstalled: typeof window !== 'undefined' && !!window.tronLink,
    formatBalance: (balance: string) => parseFloat(balance).toFixed(4),
  };
}