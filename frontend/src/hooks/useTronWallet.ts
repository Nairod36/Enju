import { useState, useEffect, useCallback } from 'react';
import { TRON_FUSION_BRIDGE_ABI } from '../config/tronABI';

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
  manuallyDisconnected: boolean;
}

export function useTronWallet() {
  // Check localStorage for manual disconnection state
  const getInitialDisconnectedState = () => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('tron-wallet-manually-disconnected') === 'true';
    } catch {
      return false;
    }
  };

  const [state, setState] = useState<TronWalletState>({
    address: null,
    isConnected: false,
    balance: null,
    tronWeb: null,
    isLoading: false,
    error: null,
    manuallyDisconnected: getInitialDisconnectedState(),
  });

  // Check if TronLink is installed and initialize connection (only after user permission)
  const checkTronLink = useCallback(async (requestPermission: boolean = false) => {
    if (typeof window === 'undefined') return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if TronLink is installed
      if (!window.tronLink) {
        throw new Error('TronLink extension not found');
      }

      // If requestPermission is true, ask for user permission first
      if (requestPermission) {
        try {
          console.log('🔐 Requesting TronLink permission...');
          const result = await window.tronLink.request({ method: 'tron_requestAccounts' });
          console.log('📋 TronLink permission result:', result);
          
          if (result.code !== 200) {
            throw new Error(`Connection denied by user (code: ${result.code})`);
          }
          // Wait a bit for TronLink to properly inject TronWeb with account
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (requestError) {
          console.error('❌ TronLink permission request failed:', requestError);
          throw new Error('User denied connection or TronLink request failed');
        }
      }

      // Wait for TronWeb to be ready
      let attempts = 0;
      const maxAttempts = 20; // Reduced attempts for faster response

      const waitForTronWeb = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          const check = () => {
            attempts++;

            // If we're requesting permission, we need to wait for TronWeb with account
            if (requestPermission) {
              if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
                resolve(window.tronWeb);
              } else if (attempts >= maxAttempts) {
                reject(new Error('TronLink connection timed out. Please try again.'));
              } else {
                setTimeout(check, 150);
              }
            } else {
              // If not requesting permission, just check if TronWeb exists and has connected account
              if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
                resolve(window.tronWeb);
              } else {
                reject(new Error('TronLink wallet not connected'));
              }
              return; // Don't retry if not requesting permission
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
        manuallyDisconnected: false,
      });

      // Clear manual disconnection state from localStorage
      try {
        localStorage.removeItem('tron-wallet-manually-disconnected');
      } catch (error) {
        console.warn('Failed to clear disconnection state from localStorage:', error);
      }

      console.log('✅ TRON wallet connected:', { address, balance: balanceInTrx });

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
        manuallyDisconnected: false,
      }));
      console.warn('⚠️ TRON wallet connection failed:', errorMessage);
    }
  }, []);

  // Connect to TronLink wallet
  const connectTronWallet = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      // Request connection with user permission
      await checkTronLink(true); // Pass true to request permission
    } catch (error) {
      console.error('❌ TRON wallet connection failed:', error);
    }
  }, [checkTronLink]);

  // Disconnect wallet
  const disconnectTronWallet = useCallback(async () => {
    console.log('🔄 Disconnecting TRON wallet...');
    
    try {
      // Try to disconnect from TronLink if available
      if (window.tronLink && typeof window.tronLink.request === 'function') {
        try {
          await window.tronLink.request({ method: 'tron_disconnect' });
        } catch (disconnectError) {
          console.warn('⚠️ TronLink disconnect failed:', disconnectError);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error during TronLink disconnect:', error);
    }
    
    // Always reset state regardless of TronLink response
    setState({
      address: null,
      isConnected: false,
      balance: null,
      tronWeb: null,
      isLoading: false,
      error: null,
      manuallyDisconnected: true, // Mark as manually disconnected
    });
    
    // Persist manual disconnection state
    try {
      localStorage.setItem('tron-wallet-manually-disconnected', 'true');
    } catch (error) {
      console.warn('Failed to save disconnection state to localStorage:', error);
    }
    
    console.log('✅ TRON wallet disconnected');
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
      console.log('🔗 Calling TRON contract with TronLink signing:', {
        contractAddress,
        functionSelector,
        parameters,
        options,
        from: state.address
      });

      // Ensure TronLink is ready for signing
      if (!window.tronLink) {
        throw new Error('TronLink not available for signing');
      }

      // Force TronLink to be ready for signing by requesting accounts
      try {
        await window.tronLink.request({ method: 'tron_requestAccounts' });
      } catch (requestError) {
        console.log('⚠️ TronLink account request failed, continuing anyway:', requestError);
      }

      // Define the ABI for TronFusionBridge contract
      const contractABI = TRON_FUSION_BRIDGE_ABI;

      // Get contract instance with proper ABI
      console.log('📄 Getting contract instance with ABI at:', contractAddress);
      let contract;
      try {
        contract = await state.tronWeb.contract(contractABI, contractAddress);
        console.log('✅ Contract instance created successfully with ABI');
      } catch (contractError) {
        console.error('❌ Failed to get contract instance:', contractError);
        throw new Error(`Failed to load contract at ${contractAddress}: ${contractError}`);
      }

      // Prepare the transaction with explicit settings for TronLink
      const txOptions = {
        feeLimit: 1000000000, // 1000 TRX default fee limit
        callValue: 0, // Default call value
        ...options, // Override with provided options
        from: state.address, // Always set from address
      };

      console.log('🔐 Calling contract method with TronLink signature prompt:', {
        method: functionSelector,
        parameters,
        options: txOptions
      });

      // Call the contract method - this should trigger TronLink popup
      console.log('🚀 Executing contract call...');
      const result = await contract[functionSelector](...parameters).send(txOptions);

      console.log('✅ TRON contract transaction completed:', result);
      return result;
    } catch (error) {
      console.error('❌ TRON contract call failed:', error);

      // Enhanced error reporting
      if (error && typeof error === 'object') {
        if ('message' in error) {
          console.error('❌ Error message:', error.message);
        }
        if ('code' in error) {
          console.error('❌ Error code:', error.code);
        }
        if ('type' in error) {
          console.error('❌ Error type:', error.type);
        }
      }

      // Re-throw with more context
      throw new Error(`TRON contract call failed: ${error instanceof Error ? error.message : error}`);
    }
  }, [state.tronWeb, state.isConnected, state.address]);

  // Force reconnection
  const reconnectTronWallet = useCallback(async () => {
    console.log('🔄 Force reconnecting TRON wallet...');
    
    // Clear manual disconnection state from localStorage
    try {
      localStorage.removeItem('tron-wallet-manually-disconnected');
    } catch (error) {
      console.warn('Failed to clear disconnection state from localStorage:', error);
    }
    
    // Reset state first
    setState(prev => ({ ...prev, isConnected: false, address: null, error: null, manuallyDisconnected: false }));
    
    // Wait a bit then reconnect
    setTimeout(() => {
      checkTronLink();
    }, 500);
  }, [checkTronLink]);

  // Auto-check connection on mount and when TronLink changes
  useEffect(() => {
    // Only auto-check if user was previously connected (not on first visit)
    // This prevents automatic connection on page load without user consent
    if (!state.isConnected && !state.error && !state.manuallyDisconnected) {
      // Check if TronLink is available and already has an account connected
      // but don't automatically connect - just update the UI state
      if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
        // User was already connected, safe to reconnect
        checkTronLink();
      }
    }

    // Listen for account changes using TronWeb events (if available)
    const handleAccountsChanged = () => {
      // Only reconnect if we were previously connected and not manually disconnected
      if (state.isConnected && !state.manuallyDisconnected) {
        console.log('🔄 TRON account changed, reconnecting...');
        setTimeout(() => checkTronLink(), 1000); // Delay to let TronLink update
      }
    };

    // Try different event listeners for TronLink
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (window.tronLink) {
      // Method 1: Try addEventListener if available
      if (typeof window.tronLink.addEventListener === 'function') {
        window.tronLink.addEventListener('accountsChanged', handleAccountsChanged);
      }
      
      // Only start polling if connected and not manually disconnected
      if (state.isConnected && !state.manuallyDisconnected) {
        // Polling fallback - check connection every 5 seconds (reduced frequency)
        pollInterval = setInterval(() => {
          if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58 !== state.address) {
            handleAccountsChanged();
          }
        }, 5000);
      }
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (window.tronLink && typeof window.tronLink.removeEventListener === 'function') {
        window.tronLink.removeEventListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [checkTronLink, state.address, state.isConnected, state.error, state.manuallyDisconnected]);

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
    reconnectTronWallet,
    sendTransaction,
    callContract,

    // Utils
    isInstalled: typeof window !== 'undefined' && !!window.tronLink,
    formatBalance: (balance: string) => parseFloat(balance).toFixed(4),
  };
}