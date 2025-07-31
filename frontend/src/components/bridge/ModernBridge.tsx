import React, { useState, useEffect } from "react";
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
    tronWeb
  } = useTronWallet();

  // Debug logging
  useEffect(() => {
    console.log("🔍 ModernBridge Debug:", {
      address,
      isConnected,
      chainId,
      balance: balance
        ? {
            formatted: balance.formatted,
            symbol: balance.symbol,
            value: balance.value?.toString(),
            decimals: balance.decimals,
          }
        : null,
      expectedChainId: 1,
      isMainnet: chainId === 1,
    });
  }, [address, isConnected, chainId, balance]);

  // Test RPC connection directly
  useEffect(() => {
    const testRpc = async () => {
      if (address && chainId === 1) {
        try {
          console.log("🧪 Testing RPC connection directly...");
          const response = await fetch(
            "http://vps-b11044fd.vps.ovh.net/rpc",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBalance",
                params: [address, "latest"],
                id: 1,
              }),
            }
          );
          const result = await response.json();
          console.log("🧪 Direct RPC result:", result);

          if (result.result) {
            const balanceWei = BigInt(result.result);
            const balanceEth = Number(balanceWei) / 1e18;
            console.log("🧪 Direct balance:", balanceEth, "ETH");
          }
        } catch (error) {
          console.error("🚨 RPC test failed:", error);
        }
      }
    };

    testRpc();
  }, [address, chainId]);

  const [fromAmount, setFromAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near" | "tron">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "near" | "tron">("tron");
  
  // Use price oracle for real-time conversion
  const conversion = useConversion(fromAmount, fromChain, toChain);
  // Remove nearAccount state as it will come from wallet
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bridgeData, setBridgeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
            if (typeof amount === 'string' && amount.includes('.')) {
              return sum + parseFloat(amount);
            }
            // Otherwise, treat it as wei and convert to ether
            return sum + parseFloat(ethers.utils.formatEther(amount));
          } catch (error) {
            console.warn('Failed to parse bridge amount:', bridge.amount, error);
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
    // Check required connections based on bridge direction
    const needsEthWallet = fromChain === "ethereum" || toChain === "ethereum";
    const needsNearWallet = fromChain === "near" || toChain === "near";
    const needsTronWallet = fromChain === "tron" || toChain === "tron";

    if (needsEthWallet && !isConnected) return;
    if (needsNearWallet && !nearConnected) return;
    if (needsTronWallet && !tronConnected) return;
    if (!fromAmount) return;

    const newBridgeData = {
      fromAmount,
      fromChain,
      toChain,
      logs: [] as string[],
      status: 'pending' as 'pending' | 'success' | 'error',
      txHash: '',
      secret: '',
      hashlock: ''
    };

    setBridgeData(newBridgeData as any);
    setIsModalOpen(true);
    setIsLoading(true);

    try {
      console.log('🎯 Bridge routing:', { fromChain, toChain });
      
      if (fromChain === "ethereum" && toChain === "near") {
        console.log('📍 Using ETH → NEAR bridge');
        await handleEthToNearBridge(newBridgeData);
      } else if (fromChain === "near" && toChain === "ethereum") {
        console.log('📍 Using NEAR → ETH bridge');
        await handleNearToEthBridge(newBridgeData);
      } else if (fromChain === "ethereum" && toChain === "tron") {
        console.log('📍 Using ETH → TRON bridge');
        await handleEthToTronBridge(newBridgeData);
      } else if (fromChain === "tron" && toChain === "ethereum") {
        console.log('📍 Using TRON → ETH bridge');
        await handleTronToEthBridge(newBridgeData);
      } else {
        throw new Error(`Unsupported bridge route: ${fromChain} → ${toChain}`);
      }
    } catch (error) {
      console.error('Bridge failed:', error);
      updateBridgeLog(`❌ Bridge failed: ${error}`);
      setBridgeData(prev => prev ? ({ ...prev, status: 'error' }) : null);
      setIsLoading(false);
    }
  };

  const updateBridgeLog = (message: string) => {
    setBridgeData((prev: any) => ({
      ...prev,
      logs: [...(prev?.logs || []), `[${new Date().toLocaleTimeString()}] ${message}`]
    }));
  };

  const handleEthToNearBridge = async (bridgeData: any) => {
    updateBridgeLog('🔑 Generating secret and hashlock...');
    
    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const hashlock = ethers.utils.keccak256(secret);
    
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
    
    const bridgeContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        'function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (bytes32 swapId)',
        'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)'
      ],
      signer
    );

    const tx = await bridgeContract.createETHToNEARBridge(hashlock, nearAccountId, {
      value: ethers.utils.parseEther(fromAmount),
      gasLimit: 500000,
    });

    bridgeData.txHash = tx.hash;
    updateBridgeLog(`📝 Transaction sent: ${tx.hash.substring(0, 14)}...`);
    updateBridgeLog(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    updateBridgeLog(`✅ Transaction confirmed!`);

    // Parse events for escrow address
    const escrowCreatedEvent = receipt.events?.find((event: any) => event.event === "EscrowCreated");
    
    if (escrowCreatedEvent) {
      const { escrow, amount: eventAmount } = escrowCreatedEvent.args;
      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(`🔄 Creating NEAR HTLC with your wallet...`);

      // Create NEAR HTLC
      await createNearHTLC(escrow, hashlock, eventAmount.toString());
      
      updateBridgeLog(`✅ Bridge ready! Both ETH and NEAR HTLCs created.`);
      updateBridgeLog(`⏳ Bridge-listener will monitor and auto-complete...`);
      
      setBridgeData((prev: any) => ({ ...prev, status: 'success' }));
      setIsLoading(false);
      
      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();
    }
  };

  const handleNearToEthBridge = async (bridgeData: any) => {
    updateBridgeLog('🔑 Generating secret and hashlock...');
    
    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const hashlock = ethers.utils.keccak256(secret);
    
    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;
    
    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`🚀 Initiating NEAR → ETHEREUM bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} NEAR`);
    updateBridgeLog(`📋 ETH destination: ${address}`);
    updateBridgeLog(`📝 You need to sign with NEAR wallet...`);

    // Create NEAR HTLC
    const nearAmount = ethers.utils.parseEther(fromAmount).toString();
    await createNearHTLC(address!, hashlock, nearAmount);
    
    updateBridgeLog(`✅ NEAR HTLC created successfully!`);
    updateBridgeLog(`⏳ Bridge-listener will create ETH escrow automatically...`);
    
    setBridgeData(prev => prev ? ({ ...prev, status: 'success' }) : null);
    setIsLoading(false);
    
    onBridgeSuccess?.(bridgeData);
    loadBridgeStats();
  };

  const createNearHTLC = async (ethAddress: string, hashlock: string, amount: string) => {
    const args = {
      receiver: nearAccountId,
      hashlock: Buffer.from(hashlock.slice(2), 'hex').toString('base64'),
      timelock: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
      eth_address: ethAddress
    };

    // Convert ETH wei to NEAR yocto (1:1 ratio)
    const ethWei = BigInt(amount);
    const nearYocto = ethWei * BigInt('1000000'); // Convert 10^18 to 10^24

    const result = await callFunction({
      contractId: 'mat-event.testnet',
      method: 'create_cross_chain_htlc',
      args,
      deposit: nearYocto.toString(),
      gas: '100000000000000'
    });

    updateBridgeLog(`✅ NEAR HTLC created with your wallet!`);
    return result;
  };

  const handleEthToTronBridge = async (bridgeData: any) => {
    console.log('🚀 Starting ETH → TRON bridge process');
    updateBridgeLog('🔑 Generating secret and hashlock...');
    
    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const hashlock = ethers.utils.keccak256(secret);
    
    bridgeData.secret = secret;
    bridgeData.hashlock = hashlock;
    
    updateBridgeLog(`🔒 Generated hashlock: ${hashlock.substring(0, 14)}...`);
    updateBridgeLog(`📡 Registering secret with relayer...`);
    
    // Enregistrer le secret auprès du relayer pour traitement automatique
    try {
      await fetch(`${BRIDGE_CONFIG.listenerApi}/register-secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashlock,
          secret
        })
      });
      updateBridgeLog(`✅ Secret registered with relayer`);
    } catch (error) {
      updateBridgeLog(`⚠️ Failed to register secret with relayer: ${error}`);
    }
    
    updateBridgeLog(`🚀 Initiating ETHEREUM → TRON bridge...`);
    updateBridgeLog(`💰 Amount: ${fromAmount} ETHEREUM`);
    updateBridgeLog(`📋 TRON destination: ${tronAddress}`);
    updateBridgeLog(`📝 You need to sign with MetaMask...`);

    // Create ETH HTLC using the new multi-chain contract
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    // Try using direct RPC connection instead of MetaMask to avoid issues
    const provider = new ethers.providers.JsonRpcProvider('http://vps-b11044fd.vps.ovh.net/rpc');

    // Create a signer with the hardcoded private key for testing
    const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(testPrivateKey, provider);
    
    // Get the current network and verify it's correct
    const network = await provider.getNetwork();
    console.log('🌐 Current network:', network);
    
    if (network.chainId !== 1) {
      throw new Error(`Wrong network. Expected chainId 1, got ${network.chainId}`);
    }
    
    // Vérifier l'adresse du signer
    const signerAddress = await signer.getAddress();
    console.log('👤 Signer address:', signerAddress);
    
    // Check balance
    const balance = await provider.getBalance(signerAddress);
    console.log('💰 Balance:', ethers.utils.formatEther(balance), 'ETH');
    
    console.log('📝 Contract details:', {
      contractAddress: BRIDGE_CONFIG.contractAddress,
      tronAddress,
      fromAmount,
      signerAddress
    });
    
    const bridgeContract = new ethers.Contract(
      BRIDGE_CONFIG.contractAddress,
      [
        'function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (bytes32 swapId)',
        'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)'
      ],
      signer
    );

    // Skip gas estimation and try directly with manual gas
    console.log('🔍 Skipping gas estimation, using manual gas limit...');
    console.log('📋 Parameters:', {
      hashlock,
      tronAddress,
      value: ethers.utils.parseEther(fromAmount).toString(),
      fromAmount
    });

    console.log('⚡ Calling createETHToTRONBridge...');
    // Force une adresse TRON utilisateur valide pour le test  
    const validTronAddress = tronAddress || 'TMGSeM3QLUJEbdscQnMt9ujx843arknWb2'; // Ton adresse wallet TRON
    console.log('🔧 Using TRON address:', validTronAddress);
    
    const tx = await bridgeContract.createETHToTRONBridge(hashlock, validTronAddress, {
      value: ethers.utils.parseEther(fromAmount),
      gasLimit: 500000, // Force manual gas limit
    });

    bridgeData.txHash = tx.hash;
    updateBridgeLog(`📝 Transaction sent: ${tx.hash.substring(0, 14)}...`);
    updateBridgeLog(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    updateBridgeLog(`✅ Transaction confirmed!`);

    // Parse events for escrow address
    const escrowCreatedEvent = receipt.events?.find((event: any) => event.event === "EscrowCreated");
    
    if (escrowCreatedEvent) {
      const { escrow, amount: eventAmount } = escrowCreatedEvent.args;
      updateBridgeLog(`📦 ETH HTLC created: ${escrow.substring(0, 14)}...`);
      updateBridgeLog(`🔄 Processing bridge to TRON...`);

      // The bridge-listener will automatically detect this ETH bridge and create the TRON HTLC
      const ethAmountInEther = ethers.utils.formatEther(eventAmount);
      updateBridgeLog(`💰 ETH locked: ${ethAmountInEther} ETH`);
      updateBridgeLog(`🔄 Bridge-listener will create TRON HTLC automatically...`);
      updateBridgeLog(`📱 You will receive TRX on: ${tronAddress}`);
      
      updateBridgeLog(`✅ ETH bridge initiated successfully!`);
      updateBridgeLog(`⏳ Bridge-listener is creating TRON HTLC...`);
      updateBridgeLog(`🔑 You will need to reveal the secret to claim your TRX`);
      updateBridgeLog(`💾 Secret: ${bridgeData.secret}`);
      updateBridgeLog(`🔒 Hashlock: ${hashlock.substring(0, 14)}...`);
      
      setBridgeData((prev: any) => ({ ...prev, status: 'success' }));
      setIsLoading(false);
      
      onBridgeSuccess?.(bridgeData);
      loadBridgeStats();
    }
  };

  const handleTronToEthBridge = async (bridgeData: any) => {
    updateBridgeLog('🔑 Generating secret and hashlock...');
    
    // Generate secret and hashlock
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const hashlock = ethers.utils.keccak256(secret);
    
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
    updateBridgeLog(`⏳ Bridge-listener will create ETH escrow automatically...`);
    
    setBridgeData(prev => prev ? ({ ...prev, status: 'success' }) : null);
    setIsLoading(false);
    
    onBridgeSuccess?.(bridgeData);
    loadBridgeStats();
  };

  const createTronHTLC = async (ethAddress: string, hashlock: string, amount: string) => {
    const contractAddress = BRIDGE_CONFIG.tron?.contractAddress || 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86';
    
    try {
      // Check TRON balance first
      console.log('🔍 TRON Balance Debug:', {
        rawTronBalance: tronBalance,
        tronBalanceType: typeof tronBalance,
        tronAddress: tronAddress,
        tronConnected: tronConnected,
        tronWeb: !!tronWeb
      });
      
      const currentTronBalance = parseFloat(tronBalance || '0');
      const amountTRX = parseFloat(amount) / 1000000; // Convert SUN to TRX
      const estimatedFees = 10; // Estimated 10 TRX for transaction fees (more realistic for TRON)
      const requiredAmountTRX = amountTRX + estimatedFees;
      
      updateBridgeLog(`💰 TRON Balance: ${currentTronBalance.toFixed(4)} TRX`);
      updateBridgeLog(`📊 Bridge Amount: ${amountTRX.toFixed(6)} TRX`);
      updateBridgeLog(`💸 Estimated Fees: ${estimatedFees} TRX`);
      updateBridgeLog(`🔢 Total Required: ${requiredAmountTRX.toFixed(4)} TRX`);
      
      if (currentTronBalance < requiredAmountTRX) {
        throw new Error(`Insufficient TRON balance. Need ${requiredAmountTRX.toFixed(4)} TRX, have ${currentTronBalance.toFixed(4)} TRX`);
      }
      updateBridgeLog(`🔧 TRON HTLC Parameters:`);
      updateBridgeLog(`   • Receiver: ${tronAddress}`);
      updateBridgeLog(`   • Contract: ${contractAddress}`);
      updateBridgeLog(`   • Amount in SUN: ${amount}`);
      updateBridgeLog(`   • Amount in TRX: ${tronWeb?.fromSun ? tronWeb.fromSun(amount) : parseFloat(amount) / 1000000} TRX`);
      
      // Call TRON contract using TronWeb
      const result = await callTronContract(
        contractAddress,
        'createTronBridge',
        [
          hashlock, // hashlock with 0x prefix (TronWeb expects this format)
          ethAddress, // targetAccount (ETH address to receive funds)
          'ethereum' // targetChain
        ],
        {
          callValue: amount, // Amount in SUN
          feeLimit: 1000000000 // 1000 TRX fee limit
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

  // Fonction pour révéler le secret et récupérer les TRX
  const claimTronTokens = async () => {
    if (!bridgeData.secret || !bridgeData.hashlock) {
      updateBridgeLog(`❌ Missing secret or hashlock data`);
      return;
    }

    try {
      updateBridgeLog(`🔓 Revealing secret to claim TRX...`);
      
      const contractAddress = BRIDGE_CONFIG.tron?.contractAddress || 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86';
      
      // Appeler completeSwap sur le contrat TRON
      const result = await callTronContract(
        contractAddress,
        'completeSwap',
        [
          bridgeData.hashlock, // swapId ou hashlock
          bridgeData.secret    // secret
        ],
        {
          feeLimit: 50000000 // 50 TRX fee limit
        }
      );

      updateBridgeLog(`✅ Secret revealed! TRX claimed successfully!`);
      updateBridgeLog(`📱 Transaction: ${result.substring(0, 20)}...`);
      updateBridgeLog(`💰 Check your TRON wallet for the received TRX`);
      
    } catch (error) {
      updateBridgeLog(`❌ Failed to claim TRX: ${error}`);
    }
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
                        <p>Balance: {(() => {
                          console.log('🔍 UI Balance Display:', {
                            rawTronBalance: tronBalance,
                            parsedBalance: parseFloat(tronBalance || '0'),
                            formattedBalance: parseFloat(tronBalance || '0').toFixed(4)
                          });
                          return parseFloat(tronBalance || '0').toFixed(4);
                        })()} TRX</p>
                        <p className="text-xs text-gray-400">
                          TRON Shasta ✅
                        </p>
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
                          setFromChain(e.target.value as "ethereum" | "near" | "tron")
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
                      placeholder={conversion.isLoading ? "Converting..." : "0.0"}
                      value={conversion.isLoading ? "" : conversion.convertedAmount}
                      readOnly
                      className="flex-1 text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-600"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                      <span className="text-lg">{chainLogos[toChain]}</span>
                      <select
                        value={toChain}
                        onChange={(e) =>
                          setToChain(e.target.value as "ethereum" | "near" | "tron")
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
                      {conversion.isLoading ? "🔄 Converting..." : 
                       conversion.error ? "❌ Error" : 
                       `💱 1 ${conversion.fromSymbol} = ${conversion.exchangeRate.toFixed(4)} ${conversion.toSymbol}`}
                    </span>
                    {conversion.error && (
                      <span className="text-red-500 text-xs">{conversion.error}</span>
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
                          {tronAddress.substring(0, 6)}...{tronAddress.substring(tronAddress.length - 4)}
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
                  `Bridge ${
                    fromAmount || "0"
                  } ${fromChain.toUpperCase()} → ${
                    conversion.convertedAmount && !conversion.isLoading 
                      ? parseFloat(conversion.convertedAmount).toFixed(4)
                      : "..."
                  } ${toChain.toUpperCase()}`
                )}
              </Button>

              {/* Claim TRX Button - Shown after ETH → TRON bridge */}
              {bridgeData?.status === 'success' && bridgeData?.secret && fromChain === 'ethereum' && toChain === 'tron' && (
                <Button
                  onClick={claimTronTokens}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-sm rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] mt-2"
                >
                  🔓 Reveal Secret & Claim TRX
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
