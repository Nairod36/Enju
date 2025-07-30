/**
 * IntentSwap Component
 * 
 * A modern token swap interface inspired by Orbiter Finance and integrated with 1inch Fusion API.
 * This component provides a seamless DeFi experience for token swapping on Ethereum.
 * 
 * Key Features:
 * - Real-time price quotes from 100+ DEXs via 1inch aggregation
 * - Token approval flow for ERC-20 tokens
 * - Configurable slippage protection
 * - Modern UI with loading states and error handling
 * - Transaction history tracking
 * 
 * Architecture:
 * - Uses React hooks for state management (useState, useEffect, useCallback)
 * - Integrates with wagmi for wallet connectivity
 * - Leverages ethers.js for blockchain interactions
 * - Custom oneInchService for API communication
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Settings,
  Zap,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { useAccount } from "wagmi"; // Wallet connection and account info
import { ethers } from "ethers"; // Blockchain interaction utilities
import { 
  fusionService, 
  Token, 
  FusionQuote, 
  FUSION_TOKENS,
  FusionOrder,
  OrderStatus
} from "@/services/oneInchFusionService";
import { 
  TEST_ACCOUNTS, 
  LOCAL_FORK_CONFIG,
  isConnectedToLocalFork 
} from "@/utils/localFork";

// Component props interface - allows parent components to handle swap success events
interface IntentSwapProps {
  onSwapSuccess?: (swapData: any) => void;
}

/**
 * SwapState Interface
 * 
 * Centralized state management for all Fusion swap-related data.
 * This approach keeps the component organized and makes state updates predictable.
 */
interface SwapState {
  fromToken: Token;             // Source token for the swap
  toToken: Token;               // Destination token for the swap
  fromAmount: string;           // User input amount (as string to handle decimals)
  toAmount: string;             // Calculated output amount from Fusion API
  quote: FusionQuote | null;    // Full quote object from 1inch Fusion API
  isLoadingQuote: boolean;      // Loading state for quote fetching
  slippage: number;             // User-configured slippage tolerance (0.5-5%)
  isApprovalNeeded: boolean;    // Whether token approval is required
  isApproving: boolean;         // Loading state for approval transaction
  isSwapping: boolean;          // Loading state for swap execution
  error: string | null;         // Error message display
  activeOrder: OrderStatus | null; // Active Fusion order status
  preset: 'fast' | 'medium' | 'slow'; // Fusion order execution speed
}

// Default tokens - ETH and WETH are the most common trading pair for testing
const ETH_TOKEN = FUSION_TOKENS[0]; // ETH (native token)
const WETH_TOKEN = FUSION_TOKENS[1]; // WETH (wrapped ETH - simple swap)

export function IntentSwap({ onSwapSuccess }: IntentSwapProps) {
  // Wagmi hook - provides wallet connection status, user address, and chain info
  const { address, isConnected, chainId } = useAccount();
  
  /**
   * Main Component State
   * 
   * Using a single state object instead of multiple useState calls provides:
   * - Better performance (single re-render per state update)
   * - Easier state management and debugging
   * - Atomic updates for related state changes
   */
  const [state, setState] = useState<SwapState>({
    fromToken: ETH_TOKEN,        // Start with ETH as default
    toToken: WETH_TOKEN,         // WETH is a simple swap from ETH
    fromAmount: "",              // Empty until user inputs
    toAmount: "",                // Calculated from 1inch Fusion API
    quote: null,                 // Will contain full quote data with auction info
    isLoadingQuote: false,       // UI loading state
    slippage: 1,                 // 1% default slippage (reasonable for most swaps)
    isApprovalNeeded: false,     // ETH doesn't need approval, ERC-20s do
    isApproving: false,          // Approval transaction state
    isSwapping: false,           // Swap transaction state
    error: null,                 // Error message for user feedback
    activeOrder: null,           // Currently active Fusion order
    preset: 'fast',              // Default to fast execution
  });

  /**
   * UI State Management
   * 
   * Separate state for UI elements that don't affect the core swap logic.
   * This separation keeps the main state clean and focused.
   */
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<Token[]>(FUSION_TOKENS);
  const [isLocalFork, setIsLocalFork] = useState(false);

  // Check if connected to local fork
  useEffect(() => {
    const checkFork = async () => {
      const connected = await isConnectedToLocalFork();
      setIsLocalFork(connected);
    };
    checkFork();
  }, [chainId, address]);

  /**
   * Token Loading Effect
   * 
   * Initialize with Fusion tokens only for a cleaner user experience.
   * This avoids showing hundreds of obscure tokens and focuses on well-known ones.
   */
  useEffect(() => {
    // Use only Fusion-supported tokens - no API call needed
    // This provides a curated list of well-known tokens that users actually want to trade
    setAvailableTokens(FUSION_TOKENS);
  }, []);

  /**
   * Load Available Tokens (Removed)
   * 
   * Previously fetched all tokens from 1inch API, but this created a poor UX
   * with hundreds of obscure tokens. Now we use only curated popular tokens.
   */

  /**
   * Quote Fetching Effect
   * 
   * This effect demonstrates reactive programming - it automatically triggers
   * whenever the user changes the amount or selects different tokens.
   * 
   * Dependencies: [fromAmount, fromToken.address, toToken.address]
   * - Only re-runs when these specific values change
   * - Prevents unnecessary API calls on other state changes
   */
  useEffect(() => {
    // Only fetch quote if we have a valid amount and different tokens
    if (state.fromAmount && parseFloat(state.fromAmount) > 0 && state.fromToken && state.toToken) {
      getQuote();
    } else {
      // Clear existing quote data when conditions aren't met
      setState(prev => ({ ...prev, toAmount: "", quote: null }));
    }
  }, [state.fromAmount, state.fromToken.address, state.toToken.address]);

  /**
   * Get Price Quote from 1inch Fusion API
   * 
   * useCallback optimization prevents unnecessary re-creation of this function.
   * This is important because the function is used in useEffect dependencies.
   * 
   * Process:
   * 1. Convert user input to wei/token units using ethers.js
   * 2. Call 1inch Fusion API for best route with Dutch auction mechanics
   * 3. Convert response back to human-readable format
   * 4. Check if token approval is needed (for ERC-20 tokens only)
   */
  const getQuote = useCallback(async () => {
    if (!state.fromAmount || parseFloat(state.fromAmount) <= 0) return;

    // Set loading state to show spinner in UI
    setState(prev => ({ ...prev, isLoadingQuote: true, error: null }));

    try {
      // Convert human-readable amount to token's smallest unit (wei for ETH, etc.)
      // This is crucial for accurate calculations and API communication
      const amount = ethers.utils.parseUnits(
        state.fromAmount,
        state.fromToken.decimals
      ).toString();

      console.log('🔍 FUSION QUOTE REQUEST - Detailed Parameters:', {
        'Raw Input': {
          fromAmount: state.fromAmount,
          fromToken: state.fromToken.symbol,
          toToken: state.toToken.symbol,
          slippage: state.slippage,
          userAddress: address,
          preset: state.preset
        },
        'API Parameters': {
          fromTokenAddress: state.fromToken.address,
          toTokenAddress: state.toToken.address,
          amount: amount,
          walletAddress: address || "",
          slippage: state.slippage
        },
        'Token Details': {
          fromToken: {
            symbol: state.fromToken.symbol,
            address: state.fromToken.address,
            decimals: state.fromToken.decimals,
            name: state.fromToken.name
          },
          toToken: {
            symbol: state.toToken.symbol,
            address: state.toToken.address,
            decimals: state.toToken.decimals,
            name: state.toToken.name
          }
        },
        'Validation Checks': {
          hasFromAmount: !!state.fromAmount,
          isAmountPositive: parseFloat(state.fromAmount) > 0,
          hasFromToken: !!state.fromToken,
          hasToToken: !!state.toToken,
          hasAddress: !!address,
          tokensAreDifferent: state.fromToken.address !== state.toToken.address
        }
      });

      // Call 1inch Fusion API for the best swap route with Dutch auction mechanics
      const quote = await fusionService.getFusionQuote({
        fromTokenAddress: state.fromToken.address,
        toTokenAddress: state.toToken.address,
        amount,
        walletAddress: address || "", // User's wallet address
        slippage: state.slippage,     // User's slippage tolerance
        includeTokensInfo: true,
        includeProtocols: true,
        includeGas: true,
      });

      console.log('✅ FUSION QUOTE SUCCESS - Response:', quote);

      // Validate quote response
      if (!quote || !quote.toTokenAmount) {
        console.error('❌ FUSION QUOTE VALIDATION FAILED:', {
          hasQuote: !!quote,
          quoteKeys: quote ? Object.keys(quote) : 'null',
          hasToTokenAmount: quote ? !!quote.toTokenAmount : false,
          toTokenAmount: quote ? quote.toTokenAmount : 'undefined'
        });
        throw new Error("Invalid quote response from 1inch Fusion API");
      }

      // Convert the response back to human-readable format
      const toAmount = ethers.utils.formatUnits(
        quote.toTokenAmount,
        state.toToken.decimals
      );

      console.log('📊 FUSION QUOTE CONVERSION:', {
        rawToTokenAmount: quote.toTokenAmount,
        toTokenDecimals: state.toToken.decimals,
        formattedToAmount: toAmount,
        auctionInfo: quote.auction,
        feeAmount: quote.feeAmount
      });

      // Update state with successful quote data
      setState(prev => ({
        ...prev,
        quote,
        toAmount,
        isLoadingQuote: false,
      }));

      // Check if approval is needed (only for ERC-20 tokens, not native ETH)
      // ETH doesn't need approval because it's the native token
      if (state.fromToken.address !== ETH_TOKEN.address && address) {
        checkApproval(amount);
      }
    } catch (error) {
      console.error("❌ FUSION QUOTE ERROR - Detailed error information:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        errorType: typeof error,
        state: {
          fromAmount: state.fromAmount,
          fromToken: state.fromToken?.symbol,
          toToken: state.toToken?.symbol,
          hasAddress: !!address
        }
      });
      // Handle errors gracefully with user-friendly messages
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to get Fusion quote",
        isLoadingQuote: false,
        toAmount: "",
        quote: null,
      }));
    }
  }, [state.fromAmount, state.fromToken, state.toToken, state.slippage, state.preset, address]);

  /**
   * Check Token Approval Status
   * 
   * ERC-20 tokens require explicit approval before they can be spent by smart contracts.
   * This function checks the current allowance and determines if a new approval is needed.
   * 
   * Process:
   * 1. Query current allowance from the token contract
   * 2. Compare with the amount user wants to swap
   * 3. Set approval flag if more allowance is needed
   */
  const checkApproval = async (amount: string) => {
    if (!address) return;

    try {
      // Use Fusion service to check if allowance is sufficient
      const isAllowanceSufficient = await fusionService.checkFusionAllowance(
        state.fromToken.address,
        address,
        amount
      );

      setState(prev => ({ ...prev, isApprovalNeeded: !isAllowanceSufficient }));
    } catch (error) {
      console.error("Approval check error:", error);
      // Don't show error to user for approval checks - non-critical
    }
  };

  /**
   * Handle Token Approval Transaction
   * 
   * When users need to approve a token, this function:
   * 1. Gets the approval transaction data from 1inch Fusion API
   * 2. Prompts user to sign the transaction with their wallet
   * 3. Waits for transaction confirmation
   * 4. Updates the approval status
   */
  const handleApproval = async () => {
    if (!address || !isConnected) {
      setState(prev => ({ ...prev, error: 'Wallet not connected. Please connect your wallet first.' }));
      return;
    }

    setState(prev => ({ ...prev, isApproving: true, error: null }));

    try {
      if (!window.ethereum) {
        throw new Error('No wallet provider found. Please install MetaMask or another Web3 wallet.');
      }

      // Create Web3 provider from user's wallet (MetaMask, etc.)
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      
      // Ensure the provider is connected and has accounts
      await provider.send("eth_requestAccounts", []);
      
      // Get signer with proper account handling
      const signer = provider.getSigner(address);

      // Get approval transaction data from 1inch Fusion API
      const approvalTx = await fusionService.getFusionApprovalTransaction(
        state.fromToken.address
      );

      // Send approval transaction and prompt user to sign
      const tx = await signer.sendTransaction({
        to: approvalTx.to,
        data: approvalTx.data,
        value: approvalTx.value,
        gasPrice: approvalTx.gasPrice,
        gasLimit: approvalTx.gas,
      });

      // Wait for transaction to be mined
      await tx.wait();

      // Update state to reflect successful approval
      setState(prev => ({
        ...prev,
        isApprovalNeeded: false,
        isApproving: false,
      }));
    } catch (error) {
      console.error("Approval error:", error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Approval failed",
        isApproving: false,
      }));
    }
  };

  /**
   * Execute Fusion Order Transaction
   * 
   * This is the main swap function that:
   * 1. Creates a Fusion order with intent-based mechanics
   * 2. Signs the order using the user's wallet
   * 3. Submits the order to the Fusion network
   * 4. Monitors order execution and handles success/failure
   * 
   * The 1inch Fusion protocol handles all the complex routing and MEV protection
   * through a professional resolver network with Dutch auction mechanics.
   */
  const handleSwap = async () => {
    if (!address || !state.quote) return;

    setState(prev => ({ ...prev, isSwapping: true, error: null }));

    try {
      // Validate wallet connection first
      if (!address || !isConnected) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      if (!window.ethereum) {
        throw new Error('No wallet provider found. Please install MetaMask or another Web3 wallet.');
      }

      // Create Web3 provider and signer for transaction execution
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      
      // Ensure the provider is connected and has accounts
      await provider.send("eth_requestAccounts", []);
      
      // Get signer with proper account handling
      const signer = provider.getSigner(address);
      
      // Get network information
      const network = await provider.getNetwork();
      const signerAddress = await signer.getAddress();
      const balance = await signer.getBalance();

      // Convert amount to token units (same as in getQuote)
      const amount = ethers.utils.parseUnits(
        state.fromAmount,
        state.fromToken.decimals
      ).toString();

      // 🌐 NETWORK & ADDRESS INFORMATION
      console.log('🌐 NETWORK & ADDRESS DETAILS:', {
        'Network Information': {
          chainId: network.chainId,
          networkName: network.name,
          expectedChainId: 1, // Ethereum Mainnet
          isCorrectNetwork: network.chainId === 1,
        },
        'Wallet Information': {
          connectedAddress: address,
          signerAddress: signerAddress,
          addressMatch: address?.toLowerCase() === signerAddress.toLowerCase(),
          walletBalance: ethers.utils.formatEther(balance),
          walletBalanceWei: balance.toString(),
        },
        'Token Addresses': {
          fromTokenAddress: state.fromToken.address,
          fromTokenSymbol: state.fromToken.symbol,
          fromTokenName: state.fromToken.name,
          toTokenAddress: state.toToken.address,
          toTokenSymbol: state.toToken.symbol,
          toTokenName: state.toToken.name,
          isETHSwap: state.fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        },
        'Provider Information': {
          providerConnected: !!provider,
          signerConnected: !!signer,
          walletProvider: (window as any).ethereum?.isMetaMask ? 'MetaMask' : 
                          (window as any).ethereum?.isWalletConnect ? 'WalletConnect' : 
                          (window as any).ethereum?.isCoinbaseWallet ? 'Coinbase' : 
                          'Unknown Wallet',
        }
      });

      console.log('🚀 FUSION SWAP REQUEST - Initiating order with detailed parameters:', {
        'Component State': {
          fromToken: state.fromToken.symbol,
          fromTokenAddress: state.fromToken.address,
          toToken: state.toToken.symbol,
          toTokenAddress: state.toToken.address,
          fromAmount: state.fromAmount,
          slippage: state.slippage,
          preset: state.preset,
          hasQuote: !!state.quote,
          isApprovalNeeded: state.isApprovalNeeded
        },
        'Calculated Values': {
          amount: amount,
          walletAddress: address,
          provider: !!provider,
          signer: !!signer
        },
        'Fusion Parameters': {
          fromTokenAddress: state.fromToken.address,
          toTokenAddress: state.toToken.address,
          amount: amount,
          walletAddress: address,
          slippage: state.slippage,
          preset: state.preset,
          allowPartialFill: true,
          allowMultipleFills: false
        },
        'Environment Check': {
          hasWindow: typeof window !== 'undefined',
          hasEthereum: !!(window as any).ethereum,
          isConnected: !!address,
          chainId: chainId
        }
      });

      // Step 1: Create Fusion order with intent-based mechanics
      const orderResponse = await fusionService.createFusionOrder({
        fromTokenAddress: state.fromToken.address,
        toTokenAddress: state.toToken.address,
        amount,
        walletAddress: address,
        slippage: state.slippage,
        preset: state.preset,
        allowPartialFill: true,
        allowMultipleFills: false,
      });

      console.log('✅ FUSION ORDER CREATED - Successfully received:', {
        orderResponse: orderResponse,
        hasOrder: !!orderResponse.order,
        hasSignature: !!orderResponse.signature,
        hasQuoteId: !!orderResponse.quoteId,
        orderKeys: Object.keys(orderResponse)
      });

      // Step 2: Sign the order using user's wallet
      const signature = await fusionService.signFusionOrder(orderResponse.order, address);

      console.log('✅ FUSION ORDER SIGNED - Order signature created');

      // Step 3: Submit the order to the Fusion network
      const submitResponse = await fusionService.submitFusionOrder(
        orderResponse.order,
        signature,
        orderResponse.quoteId
      );

      console.log('✅ FUSION ORDER SUBMITTED - Order in execution:', {
        orderHash: submitResponse.orderHash,
        success: submitResponse.success
      });

      // Step 4: Execute the actual swap transaction
      if (submitResponse.success && submitResponse.orderHash && orderResponse.interaction) {
        // Create Web3 provider for transaction execution
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();

        // Prepare transaction details
        const transactionValue = state.fromToken.address === ETH_TOKEN.address ? amount : '0';
        
        // 📋 TRANSACTION DETAILS LOGGING
        console.log('📋 TRANSACTION EXECUTION DETAILS:', {
          'Transaction Parameters': {
            to: orderResponse.interaction.target,
            data: orderResponse.interaction.data,
            value: transactionValue,
            valueInETH: ethers.utils.formatEther(transactionValue),
            from: address,
          },
          'Contract Addresses': {
            targetContract: orderResponse.interaction.target,
            fromTokenContract: state.fromToken.address,
            toTokenContract: state.toToken.address,
            isETHSwap: state.fromToken.address === ETH_TOKEN.address,
          },
          'Network Verification': {
            currentChainId: chainId,
            expectedChainId: 1,
            networkCorrect: chainId === 1,
          },
          'Gas Estimation': {
            estimatedGas: state.quote?.estimatedGas || 'Not available',
            willEstimateGas: true,
          }
        });

        // Execute the swap transaction
        const tx = await signer.sendTransaction({
          to: orderResponse.interaction.target,
          data: orderResponse.interaction.data,
          value: transactionValue,
        });

        console.log('🚀 SWAP TRANSACTION SENT - Complete Details:', {
          transactionHash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value?.toString(),
          valueInETH: tx.value ? ethers.utils.formatEther(tx.value) : '0',
          gasLimit: tx.gasLimit?.toString(),
          gasPrice: tx.gasPrice?.toString(),
          gasPriceInGwei: tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, 'gwei') : 'N/A',
          nonce: tx.nonce,
          chainId: tx.chainId,
          data: tx.data?.substring(0, 100) + '...', // Truncate data for readability
        });

        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        console.log('✅ SWAP TRANSACTION CONFIRMED - Complete Receipt Details:', {
          'Transaction Receipt': {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
            gasUsed: receipt.gasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            effectiveGasPriceGwei: receipt.effectiveGasPrice ? 
              ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei') : 'N/A',
            status: receipt.status, // 1 = success, 0 = failed
            confirmations: receipt.confirmations,
          },
          'Network Information': {
            chainId: chainId,
            network: 'Ethereum Mainnet',
            explorerLink: `https://etherscan.io/tx/${receipt.transactionHash}`,
          },
          'Gas Analysis': {
            gasUsed: receipt.gasUsed?.toString(),
            gasLimit: tx.gasLimit?.toString(),
            gasEfficiency: receipt.gasUsed && tx.gasLimit ? 
              `${((receipt.gasUsed.toNumber() / tx.gasLimit.toNumber()) * 100).toFixed(2)}%` : 'N/A',
            totalCostETH: receipt.gasUsed && receipt.effectiveGasPrice ? 
              ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)) : 'N/A',
          },
          'Event Logs': {
            logsCount: receipt.logs?.length || 0,
            hasLogs: (receipt.logs?.length || 0) > 0,
          }
        });

        // Store the active order for status tracking
        setState(prev => ({
          ...prev,
          activeOrder: {
            orderHash: submitResponse.orderHash,
            status: 'filled',
            remainingMakerAmount: '0',
            fills: [{
              txHash: receipt.transactionHash,
              filledMakerAmount: amount,
              filledTakerAmount: orderResponse.order.takerAmount,
              timestamp: Date.now(),
            }],
            createdAt: Date.now(),
            fillTx: [receipt.transactionHash],
          },
          isSwapping: false,
          fromAmount: "",
          toAmount: "",
          quote: null,
        }));

        // Notify parent component of successful swap
        onSwapSuccess?.({
          fromToken: state.fromToken,
          toToken: state.toToken,
          fromAmount: state.fromAmount,
          toAmount: state.toAmount,
          orderHash: submitResponse.orderHash,
          txHash: receipt.transactionHash,
          fills: [{
            txHash: receipt.transactionHash,
            filledMakerAmount: amount,
            filledTakerAmount: orderResponse.order.takerAmount,
            timestamp: Date.now(),
          }],
        });
      }

    } catch (error) {
      console.error("❌ FUSION SWAP ERROR - Detailed error information:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        errorType: typeof error,
        swapState: {
          hasQuote: !!state.quote,
          fromAmount: state.fromAmount,
          fromToken: state.fromToken?.symbol,
          toToken: state.toToken?.symbol,
          isApprovalNeeded: state.isApprovalNeeded,
          slippage: state.slippage,
          preset: state.preset
        },
        walletState: {
          hasAddress: !!address,
          address: address,
          chainId: chainId,
          isConnected: isConnected
        }
      });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Fusion swap failed",
        isSwapping: false,
      }));
    }
  };

  /**
   * Swap Token Positions
   * 
   * Allows users to quickly reverse the swap direction (From ↔ To).
   * This is a common UX pattern in DEX interfaces.
   * Also preserves the current toAmount as the new fromAmount for convenience.
   */
  const handleSwapTokens = () => {
    setState(prev => ({
      ...prev,
      fromToken: prev.toToken,      // Swap the tokens
      toToken: prev.fromToken,
      fromAmount: prev.toAmount,    // Use calculated amount as new input
      toAmount: "",                 // Clear to trigger new quote
      quote: null,                  // Clear existing quote data
    }));
  };

  /**
   * Token Selection Handler
   * 
   * Updates the selected token and clears dependent state.
   * Separating this into a function makes the UI code cleaner.
   */
  const selectToken = (token: Token, type: 'from' | 'to') => {
    setState(prev => ({
      ...prev,
      [type === 'from' ? 'fromToken' : 'toToken']: token,
      toAmount: "",    // Clear calculated amount
      quote: null,     // Clear quote to trigger new one
    }));
    setShowTokenSelector(null); // Close the modal
  };

  /**
   * Dynamic Button Text Logic
   * 
   * Provides contextual button text based on current state.
   * This improves UX by clearly indicating what action will be taken.
   */
  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (chainId !== 1) return "Switch to Ethereum";         // Wrong network
    if (!state.fromAmount) return "Enter Amount";           // No input
    if (state.isLoadingQuote) return "Getting Quote...";    // Loading
    if (state.error) return "Error";                        // Error state
    if (state.isApprovalNeeded) return `Approve ${state.fromToken.symbol}`; // Need approval
    if (state.isApproving) return "Approving...";           // Approving
    if (state.isSwapping) return "Creating Order...";       // Creating Fusion order
    if (state.activeOrder?.status === 'pending') return "Order Pending..."; // Order executing
    return `Create Fusion Order`; // Ready to create order
  };

  /**
   * Button Disabled Logic
   * 
   * Prevents users from initiating swaps when conditions aren't met.
   * Comprehensive validation ensures good UX and prevents failed transactions.
   */
  const isButtonDisabled = () => {
    return (
      !isConnected ||           // No wallet connected
      chainId !== 1 ||          // Wrong network (not Ethereum)
      !state.fromAmount ||      // No amount entered
      state.isLoadingQuote ||   // Still getting quote
      state.isApproving ||      // Approval in progress
      state.isSwapping ||       // Swap in progress
      !!state.error             // Error present
    );
  };

  /**
   * Number Formatting Utility
   * 
   * Formats numbers for display with appropriate precision.
   * Handles edge cases like very small numbers and provides clean formatting.
   */
  const formatNumber = (value: string, decimals: number = 6) => {
    const num = parseFloat(value);
    if (num === 0) return "0";
    if (num < 0.000001) return "<0.000001";  // Handle dust amounts
    return num.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    });
  };

  /**
   * COMPONENT RENDER
   * 
   * The UI follows modern DeFi design patterns inspired by Orbiter Finance:
   * - Clean, card-based layout
   * - Gradient accents for visual appeal
   * - Clear visual hierarchy
   * - Responsive design principles
   * - Accessible color contrasts and interactive elements
   */
  return (
    <div className="space-y-4">
      {/* Development Notice for Local Fork */}
      {isLocalFork && address && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  🔧 Development Mode - Local Ethereum Fork
                </h3>
                <p className="text-sm text-yellow-700 mb-2">
                  Connected to local fork at <code className="bg-yellow-100 px-1 rounded">{LOCAL_FORK_CONFIG.rpcUrl}</code>
                </p>
                {address && !TEST_ACCOUNTS.some(acc => acc.address.toLowerCase() === address.toLowerCase()) && (
                  <div className="text-sm text-yellow-700">
                    <p className="mb-1">⚠️ Your current wallet doesn't have test ETH. Use a test account:</p>
                    <div className="bg-yellow-100 p-2 rounded text-xs font-mono">
                      <div>Address: {TEST_ACCOUNTS[0].address}</div>
                      <div>Private Key: {TEST_ACCOUNTS[0].privateKey}</div>
                    </div>
                    <p className="mt-1 text-xs">
                      <a href="/dev/fork" className="underline hover:no-underline">
                        Visit /dev/fork for complete setup instructions
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Section - Establishes component identity and branding */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Intent Swap
        </h2>
        <p className="text-sm text-gray-500">
          Powered by 1inch Fusion SDK
        </p>
      </div>

      {/* Main Swap Interface Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 bg-white/90 backdrop-blur-sm rounded-lg">
          <div className="space-y-4">
            
            {/* Settings Button - Positioned in top-right for easy access */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* 
              Collapsible Settings Panel
              - Only shows when user clicks settings
              - Provides slippage tolerance and execution speed controls
              - Uses predefined values for ease of use
            */}
            {showSettings && (
              <div className="bg-gray-50 p-3 rounded-lg border space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Slippage Tolerance
                  </label>
                  <div className="flex gap-2">
                    {/* Predefined slippage options - common values in DeFi */}
                    {[0.5, 1, 2.5, 5].map((value) => (
                      <Button
                        key={value}
                        variant={state.slippage === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setState(prev => ({ ...prev, slippage: value }))}
                        className="text-xs"
                      >
                        {value}%
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Execution Speed (Fusion)
                  </label>
                  <div className="flex gap-2">
                    {/* Fusion execution presets */}
                    {[
                      { value: 'fast', label: 'Fast', desc: 'Higher fees, quicker execution' },
                      { value: 'medium', label: 'Medium', desc: 'Balanced speed and cost' },
                      { value: 'slow', label: 'Slow', desc: 'Lower fees, patient execution' }
                    ].map((preset) => (
                      <Button
                        key={preset.value}
                        variant={state.preset === preset.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setState(prev => ({ ...prev, preset: preset.value as 'fast' | 'medium' | 'slow' }))}
                        className="text-xs flex-col h-auto py-2"
                        title={preset.desc}
                      >
                        <div>{preset.label}</div>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {state.preset === 'fast' && 'Higher fees, quicker execution via professional resolvers'}
                    {state.preset === 'medium' && 'Balanced speed and cost with Dutch auction mechanics'}
                    {state.preset === 'slow' && 'Lower fees, patient execution with better price discovery'}
                  </p>
                </div>
              </div>
            )}

            {/* 
              FROM Token Section
              - Clear labeling and visual hierarchy
              - Integrated token selector button
              - Real-time input handling
            */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">From</label>
              <div className="relative">
                <div className="flex gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                  {/* Amount Input - number type with step for decimals */}
                  <input
                    type="number"
                    placeholder="0.0"
                    value={state.fromAmount}
                    onChange={(e) => setState(prev => ({ ...prev, fromAmount: e.target.value }))}
                    className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400"
                    step="0.000001" // Allows for precise decimal input
                  />
                  
                  {/* Token Selector Button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowTokenSelector('from')}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    {/* Token Logo - enhances visual recognition */}
                    {state.fromToken.logoURI && (
                      <img
                        src={state.fromToken.logoURI}
                        alt={state.fromToken.symbol}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="font-semibold">{state.fromToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 
              Swap Direction Button
              - Centered between token sections
              - Clear visual indicator of action
              - Follows common DEX UX patterns
            */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwapTokens}
                className="rounded-full w-10 h-10 p-0 bg-gray-50 hover:bg-gray-100 border border-gray-200 shadow-sm"
              >
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </Button>
            </div>

            {/* 
              TO Token Section
              - Read-only display of calculated output
              - Gray background indicates non-editable
              - Loading spinner shows during quote calculation
            */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">To</label>
              <div className="relative">
                <div className="flex gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  {/* Read-only output amount */}
                  <input
                    type="text"
                    placeholder={state.isLoadingQuote ? "Loading..." : "0.0"}
                    value={state.isLoadingQuote ? "" : state.toAmount}
                    readOnly
                    className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-600"
                  />
                  
                  {/* Token Selector for destination */}
                  <Button
                    variant="outline"
                    onClick={() => setShowTokenSelector('to')}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    {state.toToken.logoURI && (
                      <img
                        src={state.toToken.logoURI}
                        alt={state.toToken.symbol}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="font-semibold">{state.toToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Loading Spinner - appears during quote fetching */}
                {state.isLoadingQuote && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
            </div>

            {/* 
              Fusion Quote Information Panel
              - Only shows when we have a valid Fusion quote
              - Displays exchange rate, auction info, fees, and execution details
              - Blue color scheme indicates informational content
            */}
            {state.quote && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="space-y-2 text-sm">
                  {/* Exchange Rate Display */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate</span>
                    <span className="font-semibold">
                      1 {state.fromToken.symbol} = {formatNumber(
                        (parseFloat(state.toAmount) / parseFloat(state.fromAmount)).toString()
                      )} {state.toToken.symbol}
                    </span>
                  </div>
                  
                  {/* Gas Estimation */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Gas</span>
                    <span className="font-semibold">{formatNumber(
                      ethers.utils.formatUnits(state.quote.estimatedGas, 'gwei')
                    )} gwei</span>
                  </div>
                  
                  {/* Fusion Fee */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fusion Fee</span>
                    <span className="font-semibold">
                      {formatNumber(ethers.utils.formatEther(state.quote.feeAmount || '0'))} ETH
                    </span>
                  </div>
                  
                  {/* Dutch Auction Info */}
                  {state.quote.auction && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auction Duration</span>
                      <span className="font-semibold">{state.quote.auction.duration}s</span>
                    </div>
                  )}
                  
                  {/* Execution Preset */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Execution Speed</span>
                    <span className="font-semibold capitalize">{state.preset}</span>
                  </div>
                  
                  {/* Slippage Tolerance */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Slippage</span>
                    <span className="font-semibold">{state.slippage}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 
              Error Display Panel
              - Red color scheme for errors
              - Alert icon for visual emphasis
              - Clear, actionable error messages
            */}
            {state.error && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">{state.error}</span>
                </div>
              </div>
            )}

            {/* 
              Main Action Button
              - Dynamic text based on current state
              - Gradient styling for primary action
              - Loading spinner during operations
              - Comprehensive disabled state logic
            */}
            <Button
              onClick={state.isApprovalNeeded ? handleApproval : handleSwap}
              disabled={isButtonDisabled()}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {/* Loading spinner for async operations */}
              {(state.isApproving || state.isSwapping) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {getButtonText()}
            </Button>

            {/* 
              Protocol Attribution
              - Subtle branding for 1inch Fusion integration
              - Builds trust and transparency
            */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Zap className="w-3 h-3" />
                <span>Intent-based swaps with Dutch auction mechanics</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 
        Token Selector Modal
        - Full-screen overlay modal for token selection
        - Displays first 20 tokens for performance
        - Includes token logos and names for easy identification
        - Clean, accessible design with proper contrast
      */}
      {showTokenSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">
                Select {showTokenSelector === 'from' ? 'From' : 'To'} Token
              </h3>
            </div>
            
            {/* Token List - Scrollable container */}
            <div className="overflow-y-auto max-h-64 p-2">
              {/* 
                Token List Items
                - Show all popular tokens (curated list of famous tokens)
                - Each token shows logo, symbol, and full name
                - Click handler updates state and closes modal
              */}
              {availableTokens.map((token) => (
                <Button
                  key={token.address}
                  variant="ghost"
                  onClick={() => selectToken(token, showTokenSelector)}
                  className="w-full justify-start p-3 h-auto"
                >
                  <div className="flex items-center gap-3">
                    {/* Token Logo */}
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    
                    {/* Token Information */}
                    <div className="text-left">
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-sm text-gray-500">{token.name}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowTokenSelector(null)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
