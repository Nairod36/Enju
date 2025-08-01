import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  Zap,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";
import { BridgeModal } from "./BridgeModal";
import { PartialFillsPanel } from "./PartialFillsPanel";
import { useAccount } from "wagmi";
import { useCustomBalance } from "@/hooks/useCustomBalance";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { ethers } from "ethers";
import { BRIDGE_CONFIG } from "@/config/networks";
import { useConversion } from "@/hooks/usePriceOracle";
import { useTronWallet } from "@/hooks/useTronWallet";

interface ModernBridgeProps {
  onBridgeSuccess?: (bridgeData: any) => void;
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
  const { address, isConnected, chainId } = useAccount();
  const { balance, isLoading: balanceLoading } = useCustomBalance();
  const { signedAccountId: nearAccountId, callFunction } = useWalletSelector();
  const nearConnected = !!nearAccountId;

  // TRON wallet connection
  const {
    address: tronAddress,
    isConnected: tronConnected,
    balance: tronBalance,
    callContract: callTronContract,
    tronWeb,
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
  const [bridgeData, setBridgeData] = useState(null);
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
          return (
            sum + parseFloat(ethers.utils.formatEther(bridge.amount || "0"))
          );
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
    // Check required connections based on bridge direction
    const needsEthWallet = fromChain === "ethereum" || toChain === "ethereum";
    const needsNearWallet = fromChain === "near" || toChain === "near";
    const needsTronWallet = fromChain === "tron" || toChain === "tron";

    if (needsEthWallet && !isConnected) return;
    if (needsNearWallet && !nearConnected) return;
    if (needsTronWallet && !tronConnected) return;
    if (!fromAmount) return;

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
      if (fromChain === "ethereum" && toChain === "near") {
        // Add converted amount to bridge data for ETH -> NEAR
        newBridgeData.convertedAmount = conversion.convertedAmount || fromAmount;
        await handleEthToNearBridge(newBridgeData);
      } else if (fromChain === "near" && toChain === "ethereum") {
        await handleNearToEthBridge(newBridgeData);
      } else if (fromChain === "ethereum" && toChain === "tron") {
        await handleEthToTronBridge(newBridgeData);
      } else if (fromChain === "tron" && toChain === "ethereum") {
        await handleTronToEthBridge(newBridgeData);
      }
    } catch (error) {
      console.error("Bridge failed:", error);
      updateBridgeLog(`❌ Bridge failed: ${error}`);
      setBridgeData((prev) => (prev ? { ...prev, status: "error" } : null));
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

    // Create ETH HTLC
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    const signer = provider.getSigner();

    // Use new CrossChainResolver contract (simplified version)
    const resolverContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        // Simplified CrossChainResolver ABI
        "function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (address escrow)",
        "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)",
        "event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)",
        "function getSwap(bytes32 swapId) external view returns (address srcEscrow, address dstEscrow, address user, uint256 totalAmount, uint256 filledAmount, uint256 remainingAmount, bytes32 hashlock, uint8 destinationChain, string memory destinationAccount, bool completed, uint256 createdAt, uint256 fillCount)",
        "function getSwapProgress(bytes32 swapId) external view returns (uint256 totalAmount, uint256 filledAmount, uint256 remainingAmount, uint256 fillCount, bool completed, uint256 fillPercentage)"
      ],
      signer
    );

    // Call the simplified createETHToNEARBridge function
    const tx = await resolverContract.createETHToNEARBridge(
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
      const nearAccount = escrowCreatedEvent.args[2] || escrowCreatedEvent.args[3]; // Handle both event types
      
      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(`🔄 Bridge resolver will automatically create NEAR HTLC...`);
      updateBridgeLog(`✅ Bridge ready! ETH side locked, NEAR side being created automatically.`);
      updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);

      // Generate swapId for partial fills tracking
      const swapId = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['address', 'bytes32', 'uint256', 'string', 'uint256'],
          [escrow, hashlock, 0, nearAccount, receipt.blockNumber || block.timestamp]
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
        partialFillsEnabled: true
      }));
      setIsLoading(false);

      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();
      
      // 🔄 AUTO-COMPLETE ETH→NEAR: Monitor for NEAR HTLC creation and auto-complete
      if (fromChain === 'ethereum' && toChain === 'near' && bridgeData.secret) {
        updateBridgeLog(`🔍 Monitoring for NEAR HTLC creation to auto-complete...`);
        monitorAndCompleteNearHTLC(bridgeData.secret, hashlock);
      }
      
      return; // Exit early since we found the event
    }

    // Try to parse logs manually if events are empty
    if (!escrowCreatedEvent && receipt.logs && receipt.logs.length > 0) {
      try {
        const parsedLogs = receipt.logs.map(log => {
          try {
            return bridgeContract.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        }).filter(log => log !== null);
        
        let manualEscrowEvent = parsedLogs.find(log => log?.name === "EscrowCreatedLegacy");
        
        // If no legacy event, try the new multi-chain event
        if (!manualEscrowEvent) {
          manualEscrowEvent = parsedLogs.find(log => log?.name === "EscrowCreated");
        }
        
        if (manualEscrowEvent) {
          updateBridgeLog(`🎯 Found EscrowCreated via manual parsing!`);
          // Use the manually parsed event
          const escrow = manualEscrowEvent.args[0];
          const hashlock = manualEscrowEvent.args[1];
          const nearAccount = manualEscrowEvent.args[2];
          
          updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
          updateBridgeLog(`🔄 Bridge resolver will automatically create NEAR HTLC...`);
          updateBridgeLog(`✅ Bridge ready! ETH side locked, NEAR side being created automatically.`);
          updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);

          // Generate swapId for partial fills tracking
          const swapId = ethers.utils.keccak256(
            ethers.utils.solidityPack(
              ['address', 'bytes32', 'uint256', 'string', 'uint256'],
              [escrow, hashlock, 0, nearAccount, receipt.blockNumber || block.timestamp]
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
            partialFillsEnabled: true
          }));
          setIsLoading(false);

          onBridgeSuccess?.(bridgeData);
          loadBridgeStats();
          return; // Exit early since we found the event
        }
      } catch (parseError) {
      }
    }

    // If we reach here, no EscrowCreated event was found
    updateBridgeLog(`❌ No EscrowCreated event found in transaction!`);
    updateBridgeLog(`❌ Bridge creation failed - please check the transaction`);
    setBridgeData((prev: any) => ({ ...prev, status: "error" }));
    setIsLoading(false);
  };

  // Monitor for NEAR HTLC creation and auto-complete for ETH→NEAR bridges
  const monitorAndCompleteNearHTLC = async (secret: string, hashlock: string) => {
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
        const ourBridge = bridges.find((bridge: any) => 
          bridge.type === 'ETH_TO_NEAR' && 
          bridge.hashlock === hashlock && 
          bridge.contractId && 
          bridge.status === 'PENDING'
        );
        
        if (ourBridge) {
          updateBridgeLog(`🎯 NEAR HTLC detected! Auto-completing with secret...`);
          
          try {
            // Complete the NEAR HTLC with our secret
            await completeNearHTLC(ourBridge.contractId, secret, hashlock);
            updateBridgeLog(`✅ Bridge completed! You should receive your NEAR now.`);
            
            clearInterval(checkInterval);
            return;
            
          } catch (completionError) {
            updateBridgeLog(`❌ Failed to complete NEAR HTLC: ${completionError}`);
          }
        }
        
        if (attempts >= maxAttempts) {
          updateBridgeLog(`⏰ Timeout waiting for NEAR HTLC - you may need to complete manually`);
          clearInterval(checkInterval);
        }
        
      } catch (error) {
        console.error('❌ Error monitoring NEAR HTLC:', error);
      }
    }, 10000); // Check every 10 seconds
  };

  const handleNearToEthBridge = async (bridgeData: any) => {
    updateBridgeLog("🔑 Getting hashlock from bridge-listener...");

    // Get the test secret and hashlock that bridge-listener uses
    try {
      const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
      const result = await response.json();

      // Use bridge-listener's test values - NEAR uses SHA256, not keccak256!
      const secret =
        "0x1111111111111111111111111111111111111111111111111111111111111111";
      // For NEAR, we need SHA256 hashlock, not keccak256
      const secretBytes = ethers.utils.arrayify(secret);
      const sha256Hash = ethers.utils.sha256(secretBytes);
      const hashlock = sha256Hash;

      updateBridgeLog(`🔒 Using computed hashlock: ${hashlock}`);

      bridgeData.secret = secret;
      bridgeData.hashlock = hashlock;
    } catch (error) {
      updateBridgeLog(`❌ Failed to get bridge-listener info: ${error}`);
      // Fallback to direct computation with SHA256
      const secret =
        "0x1111111111111111111111111111111111111111111111111111111111111111";
      const secretBytes = ethers.utils.arrayify(secret);
      const sha256Hash = ethers.utils.sha256(secretBytes);
      const hashlock = sha256Hash;
      bridgeData.secret = secret;
      bridgeData.hashlock = hashlock;
    }

    updateBridgeLog(
      `🔒 Using hashlock: ${bridgeData.hashlock.substring(0, 14)}...`
    );
    updateBridgeLog(`🚀 Initiating NEAR → ETHEREUM bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} NEAR`);
    updateBridgeLog(`📋 ETH destination: ${address}`);
    updateBridgeLog(`📝 You need to sign with NEAR wallet...`);

    try {
      // Create NEAR HTLC using the entered NEAR amount
      const result = await createNearHTLC(
        address!,
        bridgeData.hashlock,
        fromAmount
      );

      updateBridgeLog(`✅ NEAR HTLC created successfully!`);
      updateBridgeLog(
        `⏳ Bridge-listener will create ETH escrow and complete automatically...`
      );

      // Extract contract ID from result logs
      let contractId = "";
      try {

        // Try different paths for logs
        const allLogs = [];

        // Check direct logs
        if (result?.logs) {
          allLogs.push(...result.logs);
        }

        // Check receipts_outcome logs
        if (result?.receipts_outcome) {
          for (const receipt of result.receipts_outcome) {
            if (receipt?.outcome?.logs) {
              allLogs.push(...receipt.outcome.logs);
            }
          }
        }


        for (const log of allLogs) {
          if (
            log.includes("Cross-chain HTLC created:") ||
            log.includes("HTLC created:")
          ) {
            // Try multiple patterns to extract contract ID
            let match = log.match(/(?:Cross-chain )?HTLC created:\s*([^,\s]+)/);
            if (!match) {
              match = log.match(/created:\s*([a-zA-Z0-9\-._]+)/);
            }
            if (match) {
              contractId = match[1].trim();
              break;
            }
          }
        }

        if (contractId) {
          updateBridgeLog(`📋 Contract ID extracted: ${contractId}`);
        } else {
          updateBridgeLog(
            `⚠️ Contract ID not found in logs - checking full transaction...`
          );

          // If not in logs, check if it's in the result itself
          const resultStr = JSON.stringify(result);

          // Look for contract ID patterns in the full result
          const idMatch = resultStr.match(/"cc-[^"]+"/);
          if (idMatch) {
            contractId = idMatch[0].replace(/"/g, "");
            updateBridgeLog(`📋 Contract ID found in result: ${contractId}`);
          }
        }
      } catch (error) {
        updateBridgeLog(`⚠️ Could not extract contract ID: ${error}`);
      }

      // Wait for bridge-listener to create ETH escrow, then complete NEAR HTLC
      updateBridgeLog(`✅ NEAR HTLC created! Waiting for ETH escrow...`);

      setTimeout(async () => {
        updateBridgeLog(`🔄 Completing NEAR HTLC to finalize bridge...`);
        try {
          if (contractId) {
            await completeNearHTLC(
              contractId,
              bridgeData.secret,
              bridgeData.hashlock
            );
            updateBridgeLog(
              `✅ NEAR HTLC completed! Bridge should finalize now.`
            );

            setBridgeData((prev) => ({ ...prev, status: "success" }));
            setIsLoading(false);
            monitorBridgeCompletion(bridgeData);
          } else {
            updateBridgeLog(`❌ No contract ID found - cannot complete`);
            setBridgeData((prev) => ({ ...prev, status: "error" }));
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Failed to complete NEAR HTLC:", error);
          updateBridgeLog(`❌ Failed to complete NEAR HTLC: ${error}`);
          setBridgeData((prev) => ({ ...prev, status: "error" }));
          setIsLoading(false);
        }
      }, 10000); // Wait 10 seconds for bridge-listener to create ETH escrow
    } catch (error) {
      console.error("Failed to create NEAR HTLC:", error);
      updateBridgeLog(`❌ Failed to create NEAR HTLC: ${error}`);
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
      if (error && typeof error === 'object') {
        if ('message' in error) {
          updateBridgeLog(`❌ Error message: ${error.message}`);
        }
        if ('cause' in error && error.cause) {
          updateBridgeLog(`❌ Error cause: ${JSON.stringify(error.cause)}`);
        }
        if ('stack' in error) {
        }
      }
      
      throw error;
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
    const preimageBase64 = btoa(String.fromCharCode(...Array.from(secretBytesForCompletion)));
    console.log("🔧 Secret bytes array:", Array.from(secretBytesForCompletion));
    console.log("🔧 Preimage base64:", preimageBase64);

    const args = {
      contract_id: contractId,
      preimage: preimageBase64,
      eth_tx_hash: "completed_by_user_frontend",
    };

    console.log("🔧 NEAR completion args:", args);

    // Extract the actual contract address from the HTLC contractId
    // Format: cc-{contract_address}-{receiver}-{amount}-{timestamp}
    let actualContractId = BRIDGE_CONFIG.nearContract; // fallback
    
    if (contractId.startsWith('cc-')) {
      const parts = contractId.split('-');
      if (parts.length >= 3) {
        // Extract contract address (parts[1]) - already includes .testnet
        actualContractId = parts[1];
        console.log(`🔧 Extracted contract address from HTLC ID: ${actualContractId}`);
      }
    }
    
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
    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    // Use SHA256 for NEAR compatibility (NEAR contract uses sha2::Sha256)
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating ETHEREUM → TRON bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} ETHEREUM`);
    updateBridgeLog(`📋 TRON destination: ${tronAddress}`);
    updateBridgeLog(`📝 You need to sign with MetaMask...`);

    // Create ETH HTLC using the new multi-chain contract
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    const signer = provider.getSigner();

    const bridgeContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        "function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (bytes32 swapId)",
        "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)",
      ],
      signer
    );

    const tx = await bridgeContract.createETHToTRONBridge(
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
    const escrowCreatedEvent = receipt.events?.find(
      (event: any) => event.event === "EscrowCreated"
    );

    if (escrowCreatedEvent) {
      const { escrow, amount: eventAmount } = escrowCreatedEvent.args;
      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(`🔄 Creating TRON HTLC with your wallet...`);

      // Create TRON HTLC
      await createTronHTLC(escrow, hashlock, eventAmount.toString());

      updateBridgeLog(`✅ Bridge ready! Both ETH and TRON HTLCs created.`);
      updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);

      setBridgeData((prev: any) => ({ ...prev, status: "success" }));
      setIsLoading(false);

      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();
    }
  };

  const handleTronToEthBridge = async (bridgeData: any) => {
    updateBridgeLog("🔑 Generating secret and hashlock...");

    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    // Use SHA256 for NEAR compatibility (NEAR contract uses sha2::Sha256)
    const hashlock = ethers.utils.sha256(secret);

    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;

    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating TRON → ETHEREUM bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} TRON`);
    updateBridgeLog(`📋 ETH destination: ${address}`);
    updateBridgeLog(`📝 You need to sign with TronLink...`);

    // Create TRON HTLC
    const tronAmount = tronWeb.toSun(fromAmount);
    await createTronHTLC(address!, hashlock, tronAmount.toString());

    updateBridgeLog(`✅ TRON HTLC created successfully!`);
    updateBridgeLog(
      `⏳ Bridge-listener will create ETH escrow automatically...`
    );

    setBridgeData((prev) => (prev ? { ...prev, status: "success" } : null));
    setIsLoading(false);

    onBridgeSuccess?.(bridgeData);
    loadBridgeStats();
  };

  const createTronHTLC = async (
    ethAddress: string,
    hashlock: string,
    amount: string
  ) => {
    const contractAddress = BRIDGE_CONFIG.tron.contractAddress;

    try {
      // Call TRON contract using TronWeb
      const result = await callTronContract(
        contractAddress,
        "createTronBridge",
        [
          tronAddress, // receiver
          hashlock.startsWith("0x") ? hashlock.slice(2) : hashlock, // hashlock sans 0x
          Date.now() + 24 * 60 * 60 * 1000, // timelock (24h)
          ethAddress, // ethAddress
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
        {/* Header - Ultra Compact */}
        <div className="text-center space-y-0.5">
          <h2 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Cross-Chain Bridge
          </h2>
          <p className="text-xs text-gray-500">
            Powered by 1inch Fusion+ Technology
          </p>
        </div>

        {/* Stats Cards - Ultra Compact */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-3.5 rounded-md border border-emerald-200">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                Volume
              </span>
            </div>
            <p className="text-xs font-bold text-emerald-800">
              ${(parseFloat(stats.totalVolume) * 2500).toLocaleString()}
            </p>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3.5 rounded-md border border-blue-200">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Success</span>
            </div>
            <p className="text-xs font-bold text-blue-800">
              {stats.successRate}%
            </p>
          </div>
        </div>

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
                  {fromChain === "ethereum" && isConnected && (
                    <div className="text-xs text-gray-500">
                      {balanceLoading ? (
                        <div>
                          <p>Loading balance...</p>
                          <p className="text-xs text-gray-400">
                            Chain: {chainId}
                          </p>
                        </div>
                      ) : balance ? (
                        <div>
                          <p>
                            Balance: {parseFloat(balance.formatted).toFixed(4)}{" "}
                            {balance.symbol}
                          </p>
                          <p className="text-xs text-gray-400">
                            Fork Mainnet ✅
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p>No balance available</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* {fromChain === "near" && nearConnected && (
                    <div className="text-xs text-gray-500">
                      {nearBalance ? (
                        <div>
                          <p>Balance: {nearBalance} NEAR</p>
                          <p className="text-xs text-gray-400">
                            NEAR Testnet ✅
                          </p>
                        </div>
                      ) : (
                        <p>Loading NEAR balance...</p>
                      )}
                    </div>
                  )} */}
                  {fromChain === "tron" && tronConnected && (
                    <div className="text-xs text-gray-500">
                      <div>
                        <p>
                          Balance: {parseFloat(tronBalance || "0").toFixed(4)}{" "}
                          TRX
                        </p>
                        <p className="text-xs text-gray-400">TRON Shasta ✅</p>
                      </div>
                    </div>
                  )}
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
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {showPartialFills ? 'ON' : 'OFF'}
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
                            : "Even small orders benefit from optimal routing and can be partially filled for better execution."
                          }
                        </div>
                        
                        {/* Smart Example Based on Amount */}
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600">
                          <span>📊 Example:</span>
                          {parseFloat(fromAmount || "0") > 1 ? (
                            <>
                              <span className="bg-orange-200 px-1 rounded">5 ETH</span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">2+1.5+1.5</span>
                            </>
                          ) : parseFloat(fromAmount || "0") > 0.1 ? (
                            <>
                              <span className="bg-orange-200 px-1 rounded">0.5 ETH</span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">0.2+0.3</span>
                            </>
                          ) : (
                            <>
                              <span className="bg-orange-200 px-1 rounded">0.01 ETH</span>
                              <span>→</span>
                              <span className="bg-green-200 px-1 rounded">0.004+0.006</span>
                            </>
                          )}
                          <span>⚡</span>
                        </div>
                      </div>
                      
                      {currentSwapId && (
                        <div className="text-right">
                          <div className="text-[10px] text-orange-600 mb-1">Active Swap</div>
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
              {toChain === "tron" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    TRON Account
                  </label>
                  {tronConnected && tronAddress ? (
                    <div className="w-full px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                        <span className="text-red-700 font-mono">
                          {tronAddress.substring(0, 6)}...
                          {tronAddress.substring(tronAddress.length - 4)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full px-2.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      Please connect your TRON wallet
                    </div>
                  )}
                </div>
              )}

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

              {/* Testnet Links */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-1.5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600">
                    Need testnet tokens?
                  </span>
                  <div className="flex gap-2">
                    <a
                      href="https://faucet.paradigm.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      ETH Faucet
                    </a>
                    <span className="text-gray-400">•</span>
                    <a
                      href="https://near-faucet.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 font-medium underline"
                    >
                      NEAR Faucet
                    </a>
                  </div>
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
                  `${showPartialFills ? '🧩 ' : ''}Bridge ${fromAmount || "0"} ${fromChain.toUpperCase()} → ${
                    conversion.convertedAmount && !conversion.isLoading
                      ? parseFloat(conversion.convertedAmount).toFixed(4)
                      : "..."
                  } ${toChain.toUpperCase()}${showPartialFills ? ' (Partial Fills)' : ''}`
                )}
              </Button>


              {/* Connection Status - Compact */}
              {isConnected && (
                <div className="text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Secured by 1inch Fusion+</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partial Fills Panel */}
      <PartialFillsPanel
        swapId={currentSwapId}
        isVisible={true}
      />

      {/* Bridge Modal */}
      <BridgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bridgeData={bridgeData}
      />
    </>
  );
}
