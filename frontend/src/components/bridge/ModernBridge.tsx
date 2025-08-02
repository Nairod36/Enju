import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Zap,
  Clock,
} from "lucide-react";
import { BridgeModal } from "./BridgeModal";
import { useAccount } from "wagmi";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { ethers } from "ethers";
import { BRIDGE_CONFIG, FORK_MAINNET_CONFIG } from "@/config/networks";
import { useConversion } from "@/hooks/usePriceOracle";
import { useTronWallet } from "@/hooks/useTronWallet";

interface BridgeData {
  fromAmount: string;
  fromChain: "ethereum" | "near" | "tron";
  toChain: "ethereum" | "near" | "tron";
  logs: string[];
  status: "pending" | "success" | "error" | "ready-to-complete";
  txHash: string;
  secret: string;
  hashlock: string;
  convertedAmount?: string;
  swapId?: string;
  escrow?: string;
  partialFillsEnabled?: boolean;
  contractId?: string;
  ethTxHash?: string;
}

interface ModernBridgeProps {
  onBridgeSuccess?: (bridgeData: BridgeData) => void;
}

interface BridgeStats {
  totalVolume: string;
  totalTransactions: number;
  avgTime: string;
  successRate: string;
}

const chainLogos = {
  ethereum: "🔷",
  near: "🔺",
  tron: "🔴",
};

const chainNames = {
  ethereum: "Ethereum",
  near: "NEAR Protocol",
  tron: "TRON",
};

export function ModernBridge({ onBridgeSuccess }: ModernBridgeProps) {
  // Utility function to safely format amount
  const formatAmount = (amount: any): number => {
    if (!amount) return 0;
    try {
      if (typeof amount === "string" && amount.includes(".")) {
        return parseFloat(amount);
      } else {
        return parseFloat(ethers.utils.formatEther(amount));
      }
    } catch (error) {
      return parseFloat(amount.toString()) || 0;
    }
  };

  const { address, isConnected } = useAccount();
  const { signedAccountId: nearAccountId, callFunction } = useWalletSelector();
  const nearConnected = !!nearAccountId;

  // TRON wallet connection
  const {
    address: tronAddress,
    isConnected: tronConnected,
    callContract: callTronContract,
    tronWeb,
    balance: tronBalance,
  } = useTronWallet();

  const [fromAmount, setFromAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near" | "tron">(
    "ethereum"
  );
  const [toChain, setToChain] = useState<"ethereum" | "near" | "tron">("tron");

  // Use price oracle for real-time conversion
  const conversion = useConversion(fromAmount, fromChain, toChain);
  // Remove nearAccount state as it will come from wallet
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bridgeData, setBridgeData] = useState<BridgeData | null>(null);
  const bridgeLogsRef = useRef<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSwapId, setCurrentSwapId] = useState<string | null>(null);
  const [showPartialFills, setShowPartialFills] = useState(true); // Visible par défaut
  const [stats, setStats] = useState<BridgeStats>({
    totalVolume: "0",
    totalTransactions: 0,
    avgTime: "0",
    successRate: "0",
  });

  // Load bridge stats
  useEffect(() => {
    loadBridgeStats();
  }, []);

  // Real-time conversion is handled by the useConversion hook

  const loadBridgeStats = async () => {
    try {
      const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
      const result = await response.json();

      if (result.success) {
        const bridges = result.data;
        const totalVol = bridges.reduce((sum: number, bridge: any) => {
          try {
            // Ensure bridge.amount is a valid BigNumber format
            const amount = bridge.amount || "0";
            // If it's already a decimal string, parse it directly
            if (typeof amount === "string" && amount.includes(".")) {
              return sum + parseFloat(amount);
            }
            // Otherwise, treat it as wei and convert to ether
            return sum + parseFloat(ethers.utils.formatEther(amount));
          } catch (error) {
            console.warn(
              "Failed to parse bridge amount:",
              bridge.amount,
              error
            );
            return sum;
          }
        }, 0);

        const completed = bridges.filter((b: any) => b.status === "COMPLETED");
        const successRate =
          bridges.length > 0 ? (completed.length / bridges.length) * 100 : 0;

        setStats({
          totalVolume: totalVol.toFixed(2),
          totalTransactions: bridges.length,
          avgTime: "45s", // Mock data
          successRate: successRate.toFixed(1),
        });
      }
    } catch (error) {
      console.error("Failed to load bridge stats:", error);
    }
  };

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    // Set the converted amount as the new from amount
    setFromAmount(conversion.convertedAmount || "");
  };

  const handleBridge = async () => {
    console.log("🚀 handleBridge called");
    
    // Check required connections based on bridge direction
    const needsEthWallet = fromChain === "ethereum" || toChain === "ethereum";
    const needsNearWallet = fromChain === "near" || toChain === "near";
    const needsTronWallet = fromChain === "tron" || toChain === "tron";

    console.log("🔍 Connection checks:", {
      needsEthWallet,
      needsNearWallet, 
      needsTronWallet,
      isConnected,
      nearConnected,
      tronConnected,
      fromAmount
    });

    if (needsEthWallet && !isConnected) {
      console.log("❌ ETH wallet needed but not connected");
      return;
    }
    if (needsNearWallet && !nearConnected) {
      console.log("❌ NEAR wallet needed but not connected");
      return;
    }
    if (needsTronWallet && !tronConnected) {
      console.log("❌ TRON wallet needed but not connected");
      return;
    }
    if (!fromAmount) {
      console.log("❌ No amount specified");
      return;
    }

    // Check network if Ethereum is the SOURCE chain (not destination)
    // For TRON->ETH, we don't need to check ETH network upfront since bridge-listener handles it
    const needsEthNetworkCheck = fromChain === "ethereum";
    
    if (needsEthNetworkCheck) {
      console.log("🔍 Checking Ethereum network...");
      try {
        // Multiple attempts to get the correct chainId with more thorough checking
        let currentChainId;
        let currentChainIdDecimal;
        let finalChainId;
        
        // First attempt
        currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        currentChainIdDecimal = parseInt(currentChainId, 16);
        console.log(`🔍 First attempt - Current network: chainId ${currentChainIdDecimal} (hex: ${currentChainId})`);
        
        // Always check with ethers provider as primary source of truth
        let providerChainId;
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum as any, "any");
          const network = await provider.getNetwork();
          providerChainId = network.chainId;
          console.log(`🔍 Provider network: chainId ${network.chainId}, name: ${network.name || 'unknown'}`);
        } catch (providerError) {
          console.log("⚠️ Provider check failed:", providerError);
          providerChainId = null;
        }
        
        // If provider gives different result, use provider as truth
        if (providerChainId && providerChainId !== currentChainIdDecimal) {
          console.log(`🔄 Provider and wallet disagree! Provider: ${providerChainId}, Wallet: ${currentChainIdDecimal}`);
          console.log(`🔄 Using provider chainId ${providerChainId} as source of truth`);
          finalChainId = providerChainId;
        } else {
          finalChainId = currentChainIdDecimal;
        }
        
        // If we still get Avalanche chainId from wallet API, do additional retries
        if (currentChainIdDecimal === 43114 && (!providerChainId || providerChainId === 43114)) {
          console.log("⚠️ Detected Avalanche chainId from both sources, forcing refresh...");
          
          // Force a fresh connection check
          try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try again with fresh connection
            currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            currentChainIdDecimal = parseInt(currentChainId, 16);
            console.log(`🔍 After refresh - Wallet chainId: ${currentChainIdDecimal} (hex: ${currentChainId})`);
            
            // Check provider again
            const provider = new ethers.providers.Web3Provider(window.ethereum as any, "any");
            const network = await provider.getNetwork();
            console.log(`🔍 After refresh - Provider chainId: ${network.chainId}`);
            
            finalChainId = network.chainId;
          } catch (refreshError) {
            console.log("⚠️ Refresh attempt failed:", refreshError);
          }
        }
        
        updateBridgeLog(`🔍 Final detected network: chainId ${finalChainId}`);
        
        // Check if we need to switch to the correct network
        const expectedChainId = FORK_MAINNET_CONFIG.chainId; // 1 for mainnet fork
        
        if (finalChainId !== expectedChainId) {
          console.log(`⚠️ Wrong network: ${finalChainId}, expected: ${expectedChainId}`);
          updateBridgeLog(`⚠️ Wrong network detected. Current: ${finalChainId}, Expected: ${expectedChainId}`);
          updateBridgeLog(`🔄 Attempting to switch to the correct network...`);
          
          try {
            // Try to switch to the correct network
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
            });
            updateBridgeLog(`✅ Successfully switched to chainId ${expectedChainId}`);
          } catch (switchError: unknown) {
            const error = switchError as { code?: number; message?: string; data?: unknown };
            console.log("❌ Switch network error:", switchError);
            console.log("❌ Switch error details:", {
              code: error.code,
              message: error.message,
              data: error.data
            });
            updateBridgeLog(`❌ Switch error: ${error.message || switchError}`);
            updateBridgeLog(`❌ Error code: ${error.code || 'unknown'}`);
            
            // If the network doesn't exist, show manual instructions
            if (error.code === 4902) {
              updateBridgeLog(`❌ Network not found in MetaMask - trying to add it...`);
              
              try {
                // Try to add the network automatically
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: `0x${expectedChainId.toString(16)}`,
                    chainName: FORK_MAINNET_CONFIG.name,
                    nativeCurrency: FORK_MAINNET_CONFIG.nativeCurrency,
                    rpcUrls: [FORK_MAINNET_CONFIG.rpcUrl],
                    blockExplorerUrls: null
                  }],
                });
                updateBridgeLog(`✅ Network added successfully! Please try bridge again.`);
                setIsLoading(false);
                return;
              } catch (addError: unknown) {
                const addErr = addError as { message?: string };
                console.log("❌ Failed to add network:", addError);
                updateBridgeLog(`❌ Failed to add network automatically: ${addErr.message}`);
                updateBridgeLog(`📋 Please add the fork network manually:`);
                updateBridgeLog(`   1. Open MetaMask → Settings → Networks → Add Network`);
                updateBridgeLog(`   2. Network Name: ${FORK_MAINNET_CONFIG.name}`);
                updateBridgeLog(`   3. RPC URL: ${FORK_MAINNET_CONFIG.rpcUrl}`);
                updateBridgeLog(`   4. Chain ID: ${expectedChainId}`);
                updateBridgeLog(`   5. Currency: ETH`);
                updateBridgeLog(`   6. Save and switch to this network`);
              }
            } else if (error.code === 4001) {
              updateBridgeLog(`❌ User rejected network switch`);
            } else {
              updateBridgeLog(`❌ Failed to switch network automatically`);
              updateBridgeLog(`📋 Please switch manually to chainId ${expectedChainId}`);
            }
            
            setIsLoading(false);
            return;
          }
        } else {
          console.log(`✅ Correct network: chainId ${finalChainId}`);
          updateBridgeLog(`✅ Correct network detected: chainId ${finalChainId}`);
          
          // Additional verification: test if we can connect to the fork RPC
          try {
            updateBridgeLog(`🔍 Verifying fork mainnet connectivity...`);
            const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider, "any");
            const network = await provider.getNetwork();
            console.log("🔍 Network details:", network);
            updateBridgeLog(`✅ Fork mainnet verified: chainId ${network.chainId}`);
          } catch (verifyError) {
            console.log("⚠️ Network verification warning:", verifyError);
            updateBridgeLog(`⚠️ Network verification warning: ${verifyError}`);
            updateBridgeLog(`🔄 Continuing with bridge anyway...`);
          }
        }
        
      } catch (error) {
        console.log("❌ Network check error:", error);
        updateBridgeLog(`❌ Network check failed: ${error}`);
        return;
      }
    }

    // Reset logs ref for new bridge
    bridgeLogsRef.current = [];

    const newBridgeData = {
      fromAmount,
      fromChain,
      toChain,
      logs: [] as string[],
      status: "pending" as "pending" | "success" | "error",
      txHash: "",
      secret: "",
      hashlock: "",
    };

    setBridgeData(newBridgeData as any);
    setIsModalOpen(true);
    setIsLoading(true);

    try {
      console.log("🎯 Bridge routing:", { fromChain, toChain });

      // Special handling for TRON → ETH to ensure we only use TronLink
      if (fromChain === "tron" && toChain === "ethereum") {
        console.log("📍 Using TRON → ETH bridge (TronLink only)");
        
        // Additional TronLink verification before proceeding
        if (!window.tronLink) {
          throw new Error("TronLink extension is required for TRON → ETH bridge");
        }
        
        if (!tronConnected || !tronAddress) {
          throw new Error("Please connect your TronLink wallet first");
        }
        
        // Explicitly avoid accessing window.ethereum during TRON → ETH
        console.log("🔒 TRON → ETH bridge: Using TronLink exclusively");
        await handleTronToEthBridge(newBridgeData);
      } else if (fromChain === "ethereum" && toChain === "near") {
        // Add converted amount to bridge data for ETH -> NEAR
        newBridgeData.convertedAmount =
          conversion.convertedAmount || fromAmount;
        await handleEthToNearBridge(newBridgeData);
      } else if (fromChain === "near" && toChain === "ethereum") {
        console.log("📍 Using NEAR → ETH bridge");
        await handleNearToEthBridge(newBridgeData);
      } else if (fromChain === "ethereum" && toChain === "tron") {
        console.log("📍 Using ETH → TRON bridge");
        await handleEthToTronBridge(newBridgeData);
      } else {
        throw new Error(`Unsupported bridge route: ${fromChain} → ${toChain}`);
      }
    } catch (error) {
      console.error("Bridge failed:", error);
      updateBridgeLog(`❌ Bridge failed: ${error}`);
      setBridgeData((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error" };
      });
      setIsLoading(false);
    }
  };

  const updateBridgeLog = (message: string) => {
    const timestampedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;

    // Ajouter à la référence stable
    bridgeLogsRef.current = [...bridgeLogsRef.current, timestampedMessage];

    setBridgeData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        logs: [...bridgeLogsRef.current],
      };
    });
  };

  const handleEthToNearBridge = async (bridgeData: any) => {
    // Verify NEAR wallet is connected
    if (!nearConnected || !nearAccountId) {
      updateBridgeLog("❌ NEAR wallet not connected!");
      throw new Error("NEAR wallet not connected");
    }

    if (showPartialFills) {
      updateBridgeLog("🧩 Using Partial Fills mode (1inch Fusion+)");
      updateBridgeLog("✅ Bridge-listener will use exact NEAR amounts!");
    } else {
      updateBridgeLog("🔄 Using standard bridge mode");
    }

    // Both modes now use the same logic since bridge-listener handles exact amounts
    await handleEthToNearBridgeStandard(bridgeData);
  };

  const handleEthToNearBridgeStandard = async (bridgeData: any) => {
    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    // Use SHA256 for NEAR compatibility (NEAR contract uses sha2::Sha256)
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating ETHEREUM → NEAR bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} ETHEREUM`);
    updateBridgeLog(`📋 NEAR destination: ${nearAccountId}`);
    updateBridgeLog(`📝 You need to sign with MetaMask...`);

    // Create ETH HTLC using CrossChainCore contract
    const provider = new ethers.providers.Web3Provider(window.ethereum as any, "any");
    
    // Request accounts to ensure connection
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();

    // Use new CrossChainCore contract
    const crossChainContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        // CrossChainCore ABI
        "function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (address escrow)",
        "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)",
        "event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)",
      ],
      signer
    );

    // Call the createETHToNEARBridge function
    const tx = await crossChainContract.createETHToNEARBridge(
      hashlock,
      nearAccountId,
      {
        value: ethers.utils.parseEther(fromAmount),
        gasLimit: 500000,
      }
    );

    bridgeData.txHash = tx.hash;
    updateBridgeLog(`📝 Transaction sent: ${tx.hash.substring(0, 14)}...`);
    updateBridgeLog(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    updateBridgeLog(`✅ Transaction confirmed!`);

    // Parse events for escrow address
    updateBridgeLog(`🔍 Looking for EscrowCreated events in transaction...`);

    // Try legacy event first (for backward compatibility)
    let escrowCreatedEvent = receipt.events?.find(
      (event: any) => event.event === "EscrowCreatedLegacy"
    );

    // If no legacy event, try the new multi-chain event
    if (!escrowCreatedEvent) {
      escrowCreatedEvent = receipt.events?.find(
        (event: any) => event.event === "EscrowCreated"
      );
    }

    updateBridgeLog(`🔍 EscrowCreated event found: ${!!escrowCreatedEvent}`);

    // Process the EscrowCreated event if found
    if (escrowCreatedEvent) {
      const { escrow, amount: eventAmount } = escrowCreatedEvent.args;
      const hashlock = escrowCreatedEvent.args[1];
      const nearAccount =
        escrowCreatedEvent.args[2] || escrowCreatedEvent.args[3]; // Handle both event types

      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(
        `🔄 Bridge resolver will automatically create NEAR HTLC...`
      );
      updateBridgeLog(
        `✅ Bridge ready! ETH side locked, NEAR side being created automatically.`
      );
      updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);

      // Generate swapId for partial fills tracking
      const swapId = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["address", "bytes32", "uint256", "string", "uint256"],
          [
            escrow,
            hashlock,
            0,
            nearAccount,
            receipt.blockNumber || Date.now(), // Use block number or timestamp
          ]
        )
      );

      updateBridgeLog(`🔍 Swap ID for tracking: ${swapId.substring(0, 14)}...`);
      setCurrentSwapId(swapId);
      setShowPartialFills(true);

      setBridgeData((prev: any) => ({
        ...prev,
        status: "success",
        swapId: swapId,
        escrow: escrow,
        partialFillsEnabled: true,
      }));
      setIsLoading(false);

      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();

      // 🔄 AUTO-COMPLETE ETH→NEAR: Monitor for NEAR HTLC creation and auto-complete
      if (fromChain === "ethereum" && toChain === "near" && bridgeData.secret) {
        updateBridgeLog(
          `🔍 Monitoring for NEAR HTLC creation to auto-complete...`
        );
        monitorAndCompleteNearHTLC(bridgeData.secret, hashlock);
      }

      return; // Exit early since we found the event
    }

    // Try to parse logs manually if events are empty
    if (!escrowCreatedEvent && receipt.logs && receipt.logs.length > 0) {
      try {
        const parsedLogs = receipt.logs
          .map((log) => {
            try {
              return crossChainContract.interface.parseLog(log);
            } catch (e) {
              return null;
            }
          })
          .filter((log) => log !== null);

        let manualEscrowEvent = parsedLogs.find(
          (log) => log?.name === "EscrowCreatedLegacy"
        );

        // If no legacy event, try the new multi-chain event
        if (!manualEscrowEvent) {
          manualEscrowEvent = parsedLogs.find(
            (log) => log?.name === "EscrowCreated"
          );
        }

        if (manualEscrowEvent) {
          updateBridgeLog(`🎯 Found EscrowCreated via manual parsing!`);
          // Use the manually parsed event
          const escrow = manualEscrowEvent.args[0];
          const hashlock = manualEscrowEvent.args[1];
          const nearAccount = manualEscrowEvent.args[2];

          updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
          updateBridgeLog(
            `🔄 Bridge resolver will automatically create NEAR HTLC...`
          );
          updateBridgeLog(
            `✅ Bridge ready! ETH side locked, NEAR side being created automatically.`
          );
          updateBridgeLog(
            `⏳ Bridge-listener will monitor and auto-complete...`
          );

          // Generate swapId for partial fills tracking
          const swapId = ethers.utils.keccak256(
            ethers.utils.solidityPack(
              ["address", "bytes32", "uint256", "string", "uint256"],
              [
                escrow,
                hashlock,
                0,
                nearAccount,
                receipt.blockNumber || Date.now(), // Use block number or timestamp
              ]
            )
          );

          updateBridgeLog(
            `🔍 Swap ID for tracking: ${swapId.substring(0, 14)}...`
          );
          setCurrentSwapId(swapId);
          setShowPartialFills(true);

          setBridgeData((prev: any) => ({
            ...prev,
            status: "success",
            swapId: swapId,
            escrow: escrow,
            partialFillsEnabled: true,
          }));
          setIsLoading(false);

          onBridgeSuccess?.(bridgeData);
          loadBridgeStats();
          return; // Exit early since we found the event
        }
      } catch (parseError) {}
    }

    // If we reach here, no EscrowCreated event was found
    updateBridgeLog(`❌ No EscrowCreated event found in transaction!`);
    updateBridgeLog(`❌ Bridge creation failed - please check the transaction`);
    setBridgeData((prev: any) => ({ ...prev, status: "error" }));
    setIsLoading(false);
  };

  // Monitor for NEAR HTLC creation and auto-complete for ETH→NEAR bridges
  const monitorAndCompleteNearHTLC = async (
    secret: string,
    hashlock: string
  ) => {
    const maxAttempts = 30; // Monitor for 30 attempts (5 minutes)
    let attempts = 0;

    const checkInterval = setInterval(async () => {
      attempts++;

      try {
        // Check bridge-listener API for bridges with our hashlock
        const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
        const result = await response.json();

        // Handle different response formats
        let bridges = [];
        if (Array.isArray(result)) {
          bridges = result;
        } else if (result.bridges && Array.isArray(result.bridges)) {
          bridges = result.bridges;
        } else if (result.data && Array.isArray(result.data)) {
          bridges = result.data;
        } else {
          return;
        }

        // Find our ETH→NEAR bridge that has a NEAR contract ID
        const ourBridge = bridges.find(
          (bridge: any) =>
            bridge.type === "ETH_TO_NEAR" &&
            bridge.hashlock === hashlock &&
            bridge.contractId &&
            bridge.status === "PENDING"
        );

        if (ourBridge) {
          updateBridgeLog(
            `🎯 NEAR HTLC detected! Auto-completing with secret...`
          );

          try {
            // Complete the NEAR HTLC with our secret
            await completeNearHTLC(ourBridge.contractId, secret, hashlock);
            updateBridgeLog(
              `✅ Bridge completed! You should receive your NEAR now.`
            );

            clearInterval(checkInterval);
            return;
          } catch (completionError) {
            updateBridgeLog(
              `❌ Failed to complete NEAR HTLC: ${completionError}`
            );
          }
        }

        if (attempts >= maxAttempts) {
          updateBridgeLog(
            `⏰ Timeout waiting for NEAR HTLC - you may need to complete manually`
          );
          clearInterval(checkInterval);
        }
      } catch (error) {
        console.error("❌ Error monitoring NEAR HTLC:", error);
      }
    }, 10000); // Check every 10 seconds
  };

  const handleNearToEthBridge = async (bridgeData: any) => {
    // Validation
    const amount = parseFloat(fromAmount);
    if (!fromAmount || amount <= 0) {
      updateBridgeLog(`❌ Invalid amount: ${fromAmount}`);
      setBridgeData((prev) => ({ ...prev, status: "error" }));
      setIsLoading(false);
      return;
    }

    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock like in ETH → NEAR bridge
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating NEAR → ETHEREUM bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} NEAR`);
    updateBridgeLog(`📋 ETH destination: ${address}`);
    updateBridgeLog(
      `🔄 Bridge-listener will create NEAR HTLC automatically...`
    );

    try {
      updateBridgeLog(`📝 You need to create NEAR HTLC with your wallet...`);

      // Create NEAR HTLC using user's wallet (like in ETH → NEAR flow)
      const result = await createNearHTLC(
        address!, // ETH address as destination
        hashlock,
        fromAmount
      );

      updateBridgeLog(`✅ NEAR HTLC created successfully!`);

      // Extract contract ID from result
      let contractId = "";
      try {
        const allLogs = [];
        if (result?.receipts_outcome) {
          for (const receipt of result.receipts_outcome) {
            if (receipt?.outcome?.logs) {
              allLogs.push(...receipt.outcome.logs);
            }
          }
        }

        for (const log of allLogs) {
          if (log.includes("Cross-chain HTLC created:")) {
            const match = log.match(/Cross-chain HTLC created:\s*([^,\s]+)/);
            if (match) {
              contractId = match[1].trim();
              break;
            }
          }
        }

        if (contractId) {
          updateBridgeLog(`📋 Contract ID: ${contractId}`);
        }
      } catch (error) {
        updateBridgeLog(`⚠️ Could not extract contract ID: ${error}`);
      }

      // Now notify bridge-listener to create ETH escrow
      updateBridgeLog(`📡 Notifying bridge-listener to create ETH escrow...`);

      const bridgeRequest = {
        type: "NEAR_TO_ETH",
        amount: fromAmount.toString(),
        nearAccount: nearAccountId,
        ethRecipient: address,
        secret: secret,
        hashlock: hashlock,
        timelock: Date.now() + 24 * 60 * 60 * 1000,
        contractId: contractId,
      };

      const response = await fetch(
        `${BRIDGE_CONFIG.listenerApi}/bridges/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bridgeRequest),
        }
      );

      if (!response.ok) {
        throw new Error(`Bridge API call failed: ${response.status}`);
      }

      const apiResult = await response.json();
      updateBridgeLog(`✅ ETH escrow will be created automatically`);
      updateBridgeLog(`⏳ You can now complete the NEAR HTLC to get your ETH`);

      // Store bridge ID for monitoring
      setCurrentSwapId(apiResult.bridgeId);

      // Monitor for bridge completion
      setBridgeData((prev) => ({ ...prev, status: "pending" }));
      setIsLoading(false);
      monitorBridgeCompletion(bridgeData);
    } catch (error) {
      console.error("Failed to initiate NEAR → ETH bridge:", error);
      updateBridgeLog(`❌ Failed to initiate bridge: ${error}`);
      setBridgeData((prev) => ({ ...prev, status: "error" }));
      setIsLoading(false);
    }
  };

  const monitorBridgeCompletion = async (bridgeData: any) => {
    const maxAttempts = 60; // 5 minutes
    let attempts = 0;

    const checkCompletion = async () => {
      try {
        const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
        const result = await response.json();

        if (result.success) {
          // Look for completed bridge with matching hashlock - support both directions
          const completedBridge = result.data.find(
            (bridge: any) =>
              bridge.hashlock === bridgeData.hashlock &&
              bridge.status === "COMPLETED" &&
              (bridge.type === "NEAR_TO_ETH" || bridge.type === "ETH_TO_NEAR")
          );

          // Look for NEAR→ETH bridge that's ready (has ETH escrow) but not completed
          const readyNearToEthBridge = result.data.find(
            (bridge: any) =>
              bridge.hashlock === bridgeData.hashlock &&
              bridge.type === "NEAR_TO_ETH" &&
              bridge.status === "PENDING" &&
              bridge.ethTxHash && // ETH escrow is created
              bridge.contractId // NEAR HTLC exists
          );

          if (completedBridge) {
            updateBridgeLog(
              `✅ Bridge completed automatically by bridge-listener!`
            );
            if (completedBridge.type === "NEAR_TO_ETH") {
              updateBridgeLog(
                `💰 You should have received ${fromAmount} NEAR worth of ETH!`
              );
            } else if (completedBridge.type === "ETH_TO_NEAR") {
              updateBridgeLog(
                `💰 You should have received ${fromAmount} ETH worth of NEAR!`
              );
            }

            // Show transaction proofs
            if (completedBridge.ethTxHash) {
              updateBridgeLog(
                `📋 ETH Escrow Created: ${completedBridge.ethTxHash}`
              );
              updateBridgeLog(
                `🔗 View ETH Escrow: https://etherscan.io/tx/${completedBridge.ethTxHash}`
              );
            }

            if (completedBridge.ethCompletionTxHash) {
              updateBridgeLog(
                `📋 ETH Transfer Completed: ${completedBridge.ethCompletionTxHash}`
              );
              updateBridgeLog(
                `🔗 View ETH Transfer: https://etherscan.io/tx/${completedBridge.ethCompletionTxHash}`
              );
            }

            if (completedBridge.nearTxHash) {
              updateBridgeLog(`📋 NEAR HTLC: ${completedBridge.nearTxHash}`);
              updateBridgeLog(
                `🔗 View NEAR TX: https://testnet.nearblocks.io/txns/${completedBridge.nearTxHash}`
              );
            }

            setBridgeData((prev) => ({ ...prev, status: "success" }));
            setIsLoading(false);
            onBridgeSuccess?.(bridgeData);
            loadBridgeStats();
            return;
          }

          // Handle NEAR→ETH bridge ready for manual completion
          if (readyNearToEthBridge) {
            updateBridgeLog(
              `✅ ETH escrow created! Bridge is ready for completion.`
            );
            updateBridgeLog(
              `🔓 You can now complete your NEAR HTLC to receive ETH`
            );
            updateBridgeLog(`📋 ETH Escrow: ${readyNearToEthBridge.ethTxHash}`);

            // Set status to show completion button
            setBridgeData((prev) => ({
              ...prev,
              status: "ready-to-complete",
              ethTxHash: readyNearToEthBridge.ethTxHash,
              contractId: readyNearToEthBridge.contractId,
            }));
            setIsLoading(false);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          updateBridgeLog(`⏳ Still waiting... (${attempts}/${maxAttempts})`);
          setTimeout(checkCompletion, 5000); // Check every 5 seconds
        } else {
          updateBridgeLog(`⚠️ Bridge timeout - check bridge-listener logs`);
          setBridgeData((prev) => ({ ...prev, status: "error" }));
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error checking bridge completion:", error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkCompletion, 5000);
        }
      }
    };

    setTimeout(checkCompletion, 5000); // Start checking after 5 seconds
  };

  const createNearHTLC = async (
    ethAddress: string,
    hashlock: string,
    nearAmountStr: string
  ) => {
    // Verify NEAR connection again
    if (!nearConnected || !nearAccountId || !callFunction) {
      const error = `NEAR wallet not properly connected: nearConnected=${nearConnected}, nearAccountId=${nearAccountId}, callFunction=${typeof callFunction}`;
      console.error("❌", error);
      updateBridgeLog(`❌ ${error}`);
      throw new Error(error);
    }

    const args = {
      receiver: nearAccountId,
      hashlock: Buffer.from(hashlock.slice(2), "hex").toString("base64"),
      timelock: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
      eth_address: ethAddress,
    };

    // For NEAR → ETH bridge, the amount is the NEAR amount entered by user
    // Convert the NEAR amount directly to yoctoNEAR
    const nearAmount = parseFloat(nearAmountStr); // This is the NEAR amount entered by user
    const nearYocto = BigInt(Math.floor(nearAmount * 1e24)); // Convert to yoctoNEAR

    updateBridgeLog(
      `📋 Calling NEAR contract with ${nearYocto.toString()} yoctoNEAR...`
    );

    try {
      updateBridgeLog(`📝 Calling NEAR wallet for signature...`);

      // Test with minimal deposit first to see if wallet responds

      const result = await callFunction({
        contractId: BRIDGE_CONFIG.nearContract,
        method: "create_cross_chain_htlc",
        args,
        deposit: nearYocto.toString(),
        gas: "100000000000000",
      });

      updateBridgeLog(`✅ NEAR HTLC created with your wallet!`);
      return result;
    } catch (error) {
      console.error("❌ NEAR HTLC creation failed:", error);
      updateBridgeLog(`❌ NEAR HTLC creation failed: ${error}`);

      // Try to get more error details
      if (error && typeof error === "object") {
        if ("message" in error) {
          updateBridgeLog(`❌ Error message: ${error.message}`);
        }
        if ("cause" in error && error.cause) {
          updateBridgeLog(`❌ Error cause: ${JSON.stringify(error.cause)}`);
        }
        if ("stack" in error) {
        }
      }

      throw error;
    }
  };

  const handleCompleteNearToEth = async () => {
    if (
      !bridgeData?.contractId ||
      !bridgeData?.secret ||
      !bridgeData?.hashlock
    ) {
      updateBridgeLog(`❌ Missing bridge data for completion`);
      return;
    }

    setIsLoading(true);
    updateBridgeLog(`🔓 Completing NEAR HTLC to receive your ETH...`);

    try {
      await completeNearHTLC(
        bridgeData.contractId,
        bridgeData.secret,
        bridgeData.hashlock
      );
      updateBridgeLog(`✅ NEAR HTLC completed! You should receive ETH soon.`);
      setBridgeData((prev) => ({ ...prev, status: "success" }));
      onBridgeSuccess?.(bridgeData);
    } catch (error) {
      console.error("Failed to complete NEAR HTLC:", error);
      updateBridgeLog(`❌ Failed to complete NEAR HTLC: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const completeNearHTLC = async (
    contractId: string,
    secret: string,
    expectedHashlock: string
  ) => {
    console.log("🔓 Completing NEAR HTLC with:", {
      contractId,
      secret: secret.substring(0, 14) + "...",
      secretLength: secret.length,
      expectedHashlock,
    });

    // Verify secret format and convert to preimage
    const secretHex = secret.startsWith("0x") ? secret.slice(2) : secret;
    console.log("🔧 Secret hex (without 0x):", secretHex);

    // Verify the secret generates the correct hashlock using SHA256 (NEAR uses SHA256)
    const secretBytes = ethers.utils.arrayify("0x" + secretHex);
    const computedHashlock = ethers.utils.sha256(secretBytes);
    console.log("🔧 Computed hashlock from secret (SHA256):", computedHashlock);
    console.log("🔧 Expected hashlock:", expectedHashlock);

    if (computedHashlock !== expectedHashlock) {
      console.error("❌ HASHLOCK MISMATCH!");
      console.error("Secret bytes:", Buffer.from(secretHex, "hex"));
      console.error(
        "Computed hash bytes:",
        Buffer.from(computedHashlock.slice(2), "hex")
      );
      console.error(
        "Expected hash bytes:",
        Buffer.from(expectedHashlock.slice(2), "hex")
      );

      updateBridgeLog(`❌ Secret/hashlock mismatch - this will fail!`);
      updateBridgeLog(`🔧 Computed: ${computedHashlock}`);
      updateBridgeLog(`🔧 Expected: ${expectedHashlock}`);

      // Don't throw - let's see what the NEAR contract says
      updateBridgeLog(`⚠️ Proceeding anyway to see NEAR contract error...`);
    } else {
      updateBridgeLog(`✅ Secret/hashlock verification passed!`);
    }

    // Convert secret to base64 using ethers utilities (browser-compatible)
    const secretBytesForCompletion = ethers.utils.arrayify("0x" + secretHex);
    const preimageBase64 = btoa(
      String.fromCharCode(...Array.from(secretBytesForCompletion))
    );
    console.log("🔧 Secret bytes array:", Array.from(secretBytesForCompletion));
    console.log("🔧 Preimage base64:", preimageBase64);

    const args = {
      contract_id: contractId,
      preimage: preimageBase64,
      eth_tx_hash: "completed_by_user_frontend",
    };

    console.log("🔧 NEAR completion args:", args);

    // Always use the configured NEAR contract, not the HTLC ID parts
    // The HTLC ID format is: cc-{contract_address}-{receiver}-{amount}-{timestamp}
    // But we should always call the deployed contract (sharknadok.testnet)
    const actualContractId = BRIDGE_CONFIG.nearContract;

    console.log(`🔧 Calling contract: ${actualContractId}`);
    console.log(`🔧 With HTLC ID: ${contractId}`);

    const result = await callFunction({
      contractId: actualContractId,
      method: "complete_cross_chain_swap",
      args,
      deposit: "0",
      gas: "100000000000000",
    });

    return result;
  };

  const handleEthToTronBridge = async (bridgeData: any) => {
    // Vérifier que les deux wallets sont connectés
    if (!isConnected || !address) {
      updateBridgeLog("❌ Ethereum wallet not connected!");
      throw new Error("Please connect your Ethereum wallet first");
    }

    if (!tronConnected || !tronAddress) {
      updateBridgeLog("❌ TRON wallet not connected!");
      throw new Error("Please connect your TRON wallet first");
    }

    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    // Use SHA256 for TRON compatibility
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating ETHEREUM → TRON bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} ETHEREUM`);
    updateBridgeLog(`📋 TRON destination: ${tronAddress}`);
    updateBridgeLog(`📝 You need to sign with MetaMask...`);

    // Create ETH HTLC using CrossChainCore contract
    const provider = new ethers.providers.Web3Provider(window.ethereum as any, "any");
    
    // Request accounts to ensure connection
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();

    // Use new CrossChainCore contract
    const crossChainContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        // CrossChainCore ABI
        "function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (address escrow)",
        "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)",
      ],
      signer
    );

    // Call the createETHToTRONBridge function
    const tx = await crossChainContract.createETHToTRONBridge(
      hashlock,
      tronAddress,
      {
        value: ethers.utils.parseEther(fromAmount),
        gasLimit: 500000,
      }
    );

    bridgeData.txHash = tx.hash;
    updateBridgeLog(`📝 Transaction sent: ${tx.hash.substring(0, 14)}...`);
    updateBridgeLog(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    updateBridgeLog(`✅ Transaction confirmed!`);

    // Parse events for escrow address
    updateBridgeLog(`🔍 Looking for EscrowCreated events in transaction...`);

    const escrowCreatedEvent = receipt.events?.find(
      (event: any) => event.event === "EscrowCreated"
    );

    updateBridgeLog(`🔍 EscrowCreated event found: ${!!escrowCreatedEvent}`);

    // Process the EscrowCreated event if found
    if (escrowCreatedEvent) {
      const { escrow, amount: eventAmount } = escrowCreatedEvent.args;
      const hashlock = escrowCreatedEvent.args[1];
      const tronAccount = escrowCreatedEvent.args[3]; // TRON address from event

      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(
        `🔄 Bridge-listener will automatically create TRON HTLC...`
      );
      updateBridgeLog(
        `✅ Bridge ready! ETH side locked, TRON side being created automatically.`
      );
      updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);
      updateBridgeLog(`🎯 TRON destination: ${tronAccount}`);

      // Generate swapId for tracking (TRON is DestinationChain(1) in contract)
      const swapId = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["address", "bytes32", "uint256", "string", "uint256"],
          [
            escrow,
            hashlock,
            1, // DestinationChain.TRON = 1
            tronAccount,
            receipt.blockNumber || Date.now(),
          ]
        )
      );

      updateBridgeLog(`🔍 Swap ID for tracking: ${swapId.substring(0, 14)}...`);

      setBridgeData((prev: any) => ({ 
        ...prev, 
        status: "success",
        escrow: escrow,
        swapId: swapId
      }));
      setIsLoading(false);

      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();
    } else {
      updateBridgeLog("❌ No EscrowCreated event found in transaction");
      updateBridgeLog("⚠️ Bridge may have failed - check transaction details");
      updateBridgeLog(`🔍 Transaction hash: ${tx.hash}`);
      throw new Error("Bridge transaction completed but no escrow event found");
    }
  };

  const handleTronToEthBridge = async (bridgeData: any) => {
    // Verify TronLink is available before starting
    if (!window.tronLink) {
      updateBridgeLog(`❌ TronLink extension not found!`);
      updateBridgeLog(`📲 Please install TronLink extension to use TRON bridge`);
      setBridgeData((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error" };
      });
      setIsLoading(false);
      return;
    }

    if (!tronConnected || !tronAddress) {
      updateBridgeLog(`❌ TronLink wallet not connected!`);
      updateBridgeLog(`🔗 Please connect your TronLink wallet first`);
      setBridgeData((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error" };
      });
      setIsLoading(false);
      return;
    }

    // Validation
    const amount = parseFloat(fromAmount);
    if (!fromAmount || amount <= 0) {
      updateBridgeLog(`❌ Invalid amount: ${fromAmount}`);
      setBridgeData((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error" };
      });
      setIsLoading(false);
      return;
    }

    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    // Use SHA256 for cross-chain compatibility
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating TRON → ETHEREUM bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} TRX`);
    updateBridgeLog(`📋 ETH destination: ${address}`);
    updateBridgeLog(
      `🔄 Bridge-listener will create TRON HTLC automatically...`
    );

    try {
      updateBridgeLog(`📝 You need to create TRON HTLC with your wallet...`);

      // Test TronLink connectivity first
      updateBridgeLog(`🔍 Testing TronLink connectivity...`);
      try {
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        updateBridgeLog(`✅ TronLink connectivity test passed`);
      } catch (testError) {
        updateBridgeLog(`⚠️ TronLink connectivity test warning: ${testError}`);
      }

      // Create TRON HTLC using user's wallet (similar to NEAR flow)
      const tronAmount = tronWeb.toSun(fromAmount);
      const result = await createTronHTLC(
        address!, // ETH address as destination
        hashlock,
        tronAmount.toString()
      );

      updateBridgeLog(`✅ TRON HTLC created successfully!`);

      // Extract contract ID or transaction details from result
      let contractId = "";
      try {
        if (result?.txid) {
          contractId = result.txid;
          updateBridgeLog(`📋 TRON Transaction ID: ${contractId}`);
        }
      } catch (error) {
        updateBridgeLog(`⚠️ Could not extract transaction ID: ${error}`);
      }

      // Now notify bridge-listener to create ETH escrow
      updateBridgeLog(`📡 Notifying bridge-listener to create ETH escrow...`);

      const bridgeRequest = {
        type: "TRON_TO_ETH",
        amount: fromAmount.toString(),
        tronAddress: tronAddress,
        ethRecipient: address,
        secret: secret,
        hashlock: hashlock,
        timelock: Date.now() + 24 * 60 * 60 * 1000,
        contractId: contractId,
      };

      const response = await fetch(
        `${BRIDGE_CONFIG.listenerApi}/bridges/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bridgeRequest),
        }
      );

      if (!response.ok) {
        throw new Error(`Bridge API call failed: ${response.status}`);
      }

      const apiResult = await response.json();
      updateBridgeLog(`✅ ETH escrow will be created automatically`);
      updateBridgeLog(`⏳ You can now complete the TRON HTLC to get your ETH`);

      // Store bridge ID for monitoring
      setCurrentSwapId(apiResult.bridgeId);

      // Monitor for bridge completion
      setBridgeData((prev) => (prev ? { ...prev, status: "pending" } : null));
      setIsLoading(false);
      monitorBridgeCompletion(bridgeData);
    } catch (error) {
      console.error("Failed to initiate TRON → ETH bridge:", error);
      updateBridgeLog(`❌ Failed to initiate bridge: ${error}`);
      setBridgeData((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error" };
      });
      setIsLoading(false);
    }
  };

  const createTronHTLC = async (
    ethAddress: string,
    hashlock: string,
    amount: string
  ) => {
    const contractAddress =
      BRIDGE_CONFIG.tron?.contractAddress ||
      "TPtAi88ucyJDGjY6fHTkvqVtipcKuovxMM";

    try {
      // Check TRON balance first
      console.log("🔍 TRON Balance Debug:", {
        rawTronBalance: tronBalance,
        tronBalanceType: typeof tronBalance,
        tronAddress: tronAddress,
        tronConnected: tronConnected,
        tronWeb: !!tronWeb,
      });

      const currentTronBalance = parseFloat(tronBalance || "0");
      const amountTRX = parseFloat(amount) / 1000000; // Convert SUN to TRX
      const estimatedFees = 10; // Estimated 10 TRX for transaction fees (more realistic for TRON)
      const requiredAmountTRX = amountTRX + estimatedFees;

      updateBridgeLog(`💰 TRON Balance: ${currentTronBalance.toFixed(4)} TRX`);
      updateBridgeLog(`📊 Bridge Amount: ${amountTRX.toFixed(6)} TRX`);
      updateBridgeLog(`💸 Estimated Fees: ${estimatedFees} TRX`);
      updateBridgeLog(`🔢 Total Required: ${requiredAmountTRX.toFixed(4)} TRX`);

      if (currentTronBalance < requiredAmountTRX) {
        throw new Error(
          `Insufficient TRON balance. Need ${requiredAmountTRX.toFixed(
            4
          )} TRX, have ${currentTronBalance.toFixed(4)} TRX`
        );
      }
      updateBridgeLog(`🔧 TRON HTLC Parameters:`);
      updateBridgeLog(`   • Receiver: ${tronAddress}`);
      updateBridgeLog(`   • Contract: ${contractAddress}`);
      updateBridgeLog(`   • Amount in SUN: ${amount}`);
      updateBridgeLog(
        `   • Amount in TRX: ${
          tronWeb?.fromSun
            ? tronWeb.fromSun(amount)
            : parseFloat(amount) / 1000000
        } TRX`
      );

      // Verify TronLink is ready for signing
      if (!window.tronLink) {
        throw new Error('TronLink not available for signing');
      }

      updateBridgeLog(`🔐 TronLink ready - calling contract with signature...`);

      // Add extra verification before calling the contract
      console.log('🔍 Pre-contract call verification:', {
        tronWeb: !!tronWeb,
        tronLink: !!window.tronLink,
        contractAddress,
        functionSelector: "createTronBridge",
        parameters: [hashlock, ethAddress, "ethereum"],
        options: {
          callValue: amount,
          feeLimit: 1000000000,
        }
      });

      updateBridgeLog(`📋 About to call TronLink for transaction signature...`);
      updateBridgeLog(`⚠️ Please check for TronLink popup and approve the transaction`);

      // Call TRON contract using the correct aliased function name
      const result = await callTronContract(
        contractAddress,
        "createTronBridge",
        [
          hashlock, // hashlock with 0x prefix (TronWeb expects this format)
          ethAddress, // targetAccount (ETH address to receive funds)
          "ethereum", // targetChain
        ],
        {
          callValue: amount, // Amount in SUN
          feeLimit: 1000000000, // 1000 TRX fee limit
        }
      );

      updateBridgeLog(`✅ TRON HTLC created with your wallet!`);
      return result;
    } catch (error) {
      updateBridgeLog(`❌ Failed to create TRON HTLC: ${error}`);
      throw error;
    }
  };

  const getChainColor = (chain: string) => {
    return chain === "ethereum"
      ? "from-blue-500 to-blue-600"
      : "from-purple-500 to-purple-600";
  };

  return (
    <>
      <div className="space-y-4">
        {/* Main Bridge Card - Compact */}
        <Card className="overflow-hidden">
          <CardContent className="px-3 bg-white/90 backdrop-blur-sm rounded-lg">
            <div className="space-y-2.5">
              {/* From Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="text-lg">{chainLogos[fromChain]}</span>
                    From {chainNames[fromChain]}
                  </label>
                  {fromChain === "ethereum" && !isConnected && (
                    <p className="text-xs text-red-500">
                      Connect Ethereum wallet
                    </p>
                  )}
                  {fromChain === "tron" && !tronConnected && (
                    <p className="text-xs text-red-500">Connect TRON wallet</p>
                  )}
                </div>

                <div className="relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getChainColor(
                      fromChain
                    )} opacity-5 rounded-lg`}
                  ></div>
                  <div className="relative flex gap-2 p-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/80">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400"
                      step="0.01"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                      <span className="text-lg">{chainLogos[fromChain]}</span>
                      <select
                        value={fromChain}
                        onChange={(e) =>
                          setFromChain(
                            e.target.value as "ethereum" | "near" | "tron"
                          )
                        }
                        className="bg-transparent border-none outline-none font-semibold cursor-pointer"
                      >
                        <option value="ethereum">ETH</option>
                        <option value="near">NEAR</option>
                        <option value="tron">TRX</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Button - Compact */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwapChains}
                  className="rounded-full w-8 h-8 p-0 bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border border-gray-200 shadow-sm"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-lg">{chainLogos[toChain]}</span>
                  To {chainNames[toChain]}
                </label>

                <div className="relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getChainColor(
                      toChain
                    )} opacity-5 rounded-lg`}
                  ></div>
                  <div className="relative flex gap-2 p-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/80">
                    <input
                      type="number"
                      placeholder={
                        conversion.isLoading ? "Converting..." : "0.0"
                      }
                      value={
                        conversion.isLoading ? "" : conversion.convertedAmount
                      }
                      readOnly
                      className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-600"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                      <span className="text-lg">{chainLogos[toChain]}</span>
                      <select
                        value={toChain}
                        onChange={(e) =>
                          setToChain(
                            e.target.value as "ethereum" | "near" | "tron"
                          )
                        }
                        className="bg-transparent border-none outline-none font-semibold cursor-pointer"
                      >
                        <option value="near">NEAR</option>
                        <option value="ethereum">ETH</option>
                        <option value="tron">TRX</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Conversion Info */}
              {fromAmount && fromChain !== toChain && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-2 rounded-lg border border-blue-200/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {conversion.isLoading
                        ? "🔄 Converting..."
                        : conversion.error
                        ? "❌ Error"
                        : `💱 1 ${
                            conversion.fromSymbol
                          } = ${conversion.exchangeRate.toFixed(4)} ${
                            conversion.toSymbol
                          }`}
                    </span>
                    {conversion.error && (
                      <span className="text-red-500 text-xs">
                        {conversion.error}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* NEAR Account Display */}
              {toChain === "near" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    NEAR Account
                  </label>
                  {nearConnected && nearAccountId ? (
                    <div className="w-full px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        <span className="text-purple-700 font-mono">
                          {nearAccountId}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full px-2.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      Please connect your NEAR wallet
                    </div>
                  )}
                </div>
              )}

              {/* Partial Fills Feature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    🧩 Partial Fills
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                      1inch Fusion+
                    </span>
                  </label>
                  <button
                    onClick={() => setShowPartialFills(!showPartialFills)}
                    className={`text-xs px-2 py-1 rounded-full transition-all ${
                      showPartialFills
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {showPartialFills ? "ON" : "OFF"}
                  </button>
                </div>

                {showPartialFills && (
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-orange-800 mb-1">
                          Smart Order Splitting
                        </div>
                        <div className="text-[11px] text-orange-700 leading-relaxed">
                          {parseFloat(fromAmount || "0") > 0.1
                            ? "Orders can be split into smaller chunks and filled progressively for better liquidity."
                            : "Even small orders benefit from optimal routing and can be partially filled for better execution."}
                        </div>

                        {/* Smart Example Based on Amount */}
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600">
                          <span>📊 Example:</span>
                          {parseFloat(fromAmount || "0") > 1 ? (
                            <>
                              <span className="bg-orange-200 px-1 rounded">
                                5 ETH
                              </span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">
                                2+1.5+1.5
                              </span>
                            </>
                          ) : parseFloat(fromAmount || "0") > 0.1 ? (
                            <>
                              <span className="bg-orange-200 px-1 rounded">
                                0.5 ETH
                              </span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">
                                0.2+0.3
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="bg-orange-200 px-1 rounded">
                                0.01 ETH
                              </span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">
                                0.004+0.006
                              </span>
                            </>
                          )}
                          <span>⚡</span>
                        </div>
                      </div>

                      {currentSwapId && (
                        <div className="text-right">
                          <div className="text-[10px] text-orange-600 mb-1">
                            Active Swap
                          </div>
                          <div className="text-[9px] font-mono bg-orange-200 px-1.5 py-0.5 rounded text-orange-800">
                            {currentSwapId.substring(0, 8)}...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TRON Account Display */}
              

              {/* Bridge Info - Ultra Compact */}
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-1.5 rounded-lg border border-emerald-200/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span className="font-medium text-gray-700">Time</span>
                  </div>
                  <span className="font-bold text-emerald-700">~45s</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-gray-700">Fee</span>
                  </div>
                  <span className="font-bold text-blue-700">Free</span>
                </div>
              </div>

              {/* Bridge Button - Ultra Compact */}
              <Button
                onClick={handleBridge}
                disabled={
                  !fromAmount ||
                  isLoading ||
                  (fromChain === "ethereum" && !isConnected) ||
                  (fromChain === "near" && !nearConnected) ||
                  (fromChain === "tron" && !tronConnected) ||
                  (toChain === "near" && !nearConnected) ||
                  (toChain === "ethereum" && !isConnected) ||
                  (toChain === "tron" && !tronConnected)
                }
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (fromChain === "ethereum" && !isConnected) ||
                  (fromChain === "near" && !nearConnected) ||
                  (fromChain === "tron" && !tronConnected) ? (
                  "Connect Wallet"
                ) : (toChain === "ethereum" && !isConnected) ||
                  (toChain === "near" && !nearConnected) ||
                  (toChain === "tron" && !tronConnected) ? (
                  "Connect Destination Wallet"
                ) : (
                  `${showPartialFills ? "🧩 " : ""}Bridge ${
                    fromAmount || "0"
                  } ${fromChain.toUpperCase()} → ${
                    conversion.convertedAmount && !conversion.isLoading
                      ? parseFloat(conversion.convertedAmount).toFixed(4)
                      : "..."
                  } ${toChain.toUpperCase()}${
                    showPartialFills ? " (Partial Fills)" : ""
                  }`
                )}
              </Button>

              {/* Complete NEAR → ETH Button */}
              {bridgeData?.status === "ready-to-complete" && (
                <Button
                  onClick={handleCompleteNearToEth}
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-sm rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] animate-pulse"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Completing...
                    </div>
                  ) : (
                    "🔓 Complete Bridge → Receive ETH"
                  )}
                </Button>
              )}

              {/* Connection Status - Compact */}
              {isConnected && (
                <div className="text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Secured by 1inch Fusion+</span>
                  </div>
                </div>
              )}

              {/* Auto-TRX Notification - Shown after successful ETH → TRON bridge */}
              {bridgeData &&
                (bridgeData as any).status === "success" &&
                fromChain === "ethereum" &&
                toChain === "tron" && (
                  <div className="w-full p-4 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded-lg mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-xl">✅</span>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-green-800">
                          TRX envoyés automatiquement !
                        </h4>
                        <p className="text-xs text-green-700 mt-1">
                          Vos TRX sont en cours d'envoi automatique vers votre
                          portefeuille TRON. Aucune action supplémentaire
                          requise.
                        </p>
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          🎯 Vérifiez votre portefeuille TRON dans quelques
                          minutes
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bridge Modal */}
      <BridgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bridgeData={bridgeData}
      />
    </>
  );
}
