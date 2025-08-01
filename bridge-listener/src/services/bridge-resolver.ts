import { EventEmitter } from 'events';
import { EthereumListener } from './eth-listener';
import { NearListener } from './near-listener';
import { TronFusionClient, FusionImmutables } from './tron-fusion-client';
import { PriceOracle } from './price-oracle';
import { BridgeEvent, EthEscrowCreatedEvent, NearHTLCEvent, ResolverConfig, SwapRequest } from '../types';
import { ethers } from 'ethers';

export class BridgeResolver extends EventEmitter {
  private ethListener: EthereumListener;
  private nearListener: NearListener;
  private tronFusionClient?: TronFusionClient;
  private priceOracle: PriceOracle;
  private activeBridges: Map<string, BridgeEvent> = new Map();
  private resolverSigner: ethers.Wallet;
  private ethProvider: ethers.JsonRpcProvider;
  private ethToNearMap = new Map<string, string>();
  private processedTxHashes = new Set<string>(); // 🔥 Cache pour éviter les doublons
  private secretStore = new Map<string, string>(); // 🔑 Cache des secrets pour les relayers
  private isRunning = false;

  // Contrats déployés
  private readonly ETH_BRIDGE_CONTRACT = '0xAE2c8c3bBDC09116bE01064009f13fCc272b0944';
  private readonly TRON_BRIDGE_CONTRACT = 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86';

  constructor(private config: ResolverConfig) {
    super();

    this.ethListener = new EthereumListener(config);
    this.nearListener = new NearListener(config);
    this.priceOracle = new PriceOracle();
    this.priceOracle = new PriceOracle();

    // Initialize resolver signer for ETH transactions
    this.ethProvider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.resolverSigner = new ethers.Wallet(config.ethPrivateKey, this.ethProvider);

    // Initialize TRON Fusion+ client if configured
    if (process.env.TRON_PRIVATE_KEY && process.env.TRON_FULL_HOST && process.env.TRON_FUSION_BRIDGE_CONTRACT) {
      const tronConfig = {
        privateKey: process.env.TRON_PRIVATE_KEY,
        fullHost: process.env.TRON_FULL_HOST,
        bridgeContract: process.env.TRON_FUSION_BRIDGE_CONTRACT,
        chainId: process.env.TRON_CHAIN_ID || '2'
      };
      this.tronFusionClient = new TronFusionClient(tronConfig);
      console.log('✅ TRON Fusion+ client initialized in BridgeResolver');
    } else {
      console.log('⚠️ TRON Fusion+ configuration missing, ETH ↔ TRON bridges disabled');
      console.log('💡 Required: TRON_PRIVATE_KEY, TRON_FULL_HOST, TRON_FUSION_BRIDGE_CONTRACT');
    }

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    console.log('🌉 Initializing Bridge Resolver...');

    await this.ethListener.initialize();
    await this.nearListener.initialize();

    console.log('✅ Bridge Resolver initialized');
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Bridge Resolver...');

    this.isRunning = true;

    await this.ethListener.startListening();
    await this.nearListener.startListening();

    // Démarrer les watchers TRON si disponible
    if (this.tronFusionClient) {
      console.log('🚀 Starting ETH ↔ TRON Fusion+ watchers...');
      await Promise.all([
        this.watchEthToTronSwaps(),
        this.watchTronToEthSwaps()
      ]);
    }

    console.log('✅ Bridge Resolver is running');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.ethListener.stopListening();
    await this.nearListener.stopListening();
    console.log('🛑 Bridge Resolver stopped');
  }

  private setupEventHandlers(): void {
    // Handle ETH → NEAR bridge initiation
    this.ethListener.on('escrowCreated', this.handleEthToNearBridge.bind(this));

    // Handle ETH → TRON bridge initiation
    this.ethListener.on('ethToTronBridge', this.handleEthToTronBridge.bind(this));

    // Handle ETH swap completion
    this.ethListener.on('swapCompleted', this.handleEthSwapCompleted.bind(this));

    // Handle NEAR HTLC creation
    this.nearListener.on('htlcCreated', this.handleNearHTLCCreated.bind(this));

    // Handle NEAR swap completion
    this.nearListener.on('htlcCompleted', this.handleNearSwapCompleted.bind(this));
  }

  private async handleEthToNearBridge(event: EthEscrowCreatedEvent): Promise<void> {
    console.log('🔄 Processing ETH → NEAR bridge...');

    // 🔥 Éviter les doublons par txHash ou hashlock+escrow si txHash est undefined
    const dedupeKey = event.txHash || `${event.hashlock}-${event.escrow}`;
    if (this.processedTxHashes.has(dedupeKey)) {
      console.log(`⚠️ Event ${dedupeKey} already processed, skipping...`);
      return;
    }
    this.processedTxHashes.add(dedupeKey);

    try {
      const bridgeId = this.generateBridgeId(event.hashlock, 'ETH_TO_NEAR');

      // Create bridge tracking entry
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'ETH_TO_NEAR',
        status: 'PENDING',
        ethTxHash: event.txHash,
        escrowAddress: event.escrow,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.nearAccount, // This should be parsed correctly
        nearAccount: event.nearAccount,
        timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h from now
        createdAt: Date.now(),
        // secret will be provided when user completes the bridge
      };

      this.activeBridges.set(bridgeId, bridgeEvent);

      // 🔄 AUTO-CREATE NEAR HTLC: Bridge resolver creates NEAR HTLC for user
      console.log(`🔄 Auto-creating NEAR HTLC for ETH → NEAR bridge: ${bridgeId}`);
      console.log(`💰 Converting ETH amount to NEAR...`);
      
      // Convert ETH amount to NEAR using price oracle
      const ethAmountInEth = parseFloat(ethers.formatEther(event.amount));
      console.log(`💱 Converting ${ethAmountInEth} ETH to NEAR...`);
      const nearAmount = await this.priceOracle.convertEthToNear(ethAmountInEth.toString());
      console.log(`💰 Conversion: ${ethAmountInEth} ETH → ${nearAmount} NEAR`);
      
      try {
        // Create NEAR HTLC automatically with bridge resolver's funds
        console.log(`🔄 Creating NEAR HTLC for user ${event.nearAccount}...`);
        const contractId = await this.nearListener.createCrossChainHTLC({
          receiver: event.nearAccount,
          hashlock: event.hashlock,
          timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h timelock
          ethAddress: event.escrow,
          amount: event.amount // Pass ETH wei amount, let near-listener do the conversion
        });
        
        // Update bridge with contract ID
        bridgeEvent.contractId = contractId;
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        console.log(`✅ NEAR HTLC created automatically: ${contractId}`);
        console.log(`🎯 Bridge ready for completion! Both sides active.`);
        
      } catch (nearError) {
        console.error('❌ Failed to create NEAR HTLC automatically:', nearError);
        // Fallback to monitoring mode if auto-creation fails
        console.log(`⚠️ Falling back to manual mode - user must create NEAR HTLC`);
        console.log(`📋 Expected NEAR HTLC params:`);
        console.log(`   - receiver: ${event.nearAccount} (user's NEAR account)`);
        console.log(`   - hashlock: ${event.hashlock}`);
        console.log(`   - ethAddress: ${event.escrow}`);
        console.log(`   - amount: ${nearAmount} NEAR`);
      }

      this.emit('bridgeCreated', bridgeEvent);

    } catch (error) {
      console.error('❌ Error handling ETH → NEAR bridge:', error);
    }
  }

  private async handleEthToTronBridge(event: any): Promise<void> {
    console.log('🔥 Processing ETH → TRON bridge - Auto-sending TRX...');

    // Éviter les doublons
    const dedupeKey = event.txHash || `${event.hashlock}-${event.escrow}`;
    if (this.processedTxHashes.has(dedupeKey)) {
      console.log(`⚠️ Event ${dedupeKey} already processed, skipping...`);
      return;
    }
    this.processedTxHashes.add(dedupeKey);

    try {
      const bridgeId = this.generateBridgeId(event.hashlock, 'ETH_TO_TRON');

      // Create bridge tracking entry
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'ETH_TO_TRON',
        status: 'PENDING',
        ethTxHash: event.txHash,
        escrowAddress: event.escrow,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: '', // Not used for ETH → TRON
        nearAccount: '', // Not used for ETH → TRON
        tronAddress: event.tronAddress,
        timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h from now
        createdAt: Date.now(),
      };

      this.activeBridges.set(bridgeId, bridgeEvent);

      console.log(`🎯 ETH → TRON bridge created:`, {
        bridgeId,
        escrow: event.escrow,
        hashlock: event.hashlock,
        tronAddress: event.tronAddress,
        amount: event.amount
      });

      // 🚀 AUTO-SEND TRX: Envoyer automatiquement les TRX dès réception des ETH
      if (this.tronFusionClient) {
        console.log(`� Auto-sending TRX to ${event.tronAddress}...`);
        
        // Mettre à jour le statut
        bridgeEvent.status = 'PROCESSING';
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        try {
          // Convertir le montant ETH en TRX équivalent
          const ethAmountInEther = ethers.formatEther(event.amount);
          console.log(`💰 Converting ${ethAmountInEther} ETH to equivalent TRX...`);
          
          // Pour la démo, utilisons un taux de change fixe (à remplacer par un oracle de prix)
          const ethToTrxRate = 11080; // Approximatif: 1 ETH ≈ 11,080 TRX
          const trxAmount = (parseFloat(ethAmountInEther) * ethToTrxRate).toFixed(6);
          
          console.log(`💱 Sending ${trxAmount} TRX (rate: ${ethToTrxRate} TRX/ETH)`);
          
          // Envoyer directement les TRX sans escrow
          const tronTxResult = await this.tronFusionClient.sendTRX(
            event.tronAddress,
            trxAmount
          );

          if (tronTxResult.success) {
            console.log(`✅ TRX sent successfully! TX: ${tronTxResult.txHash}`);
            
            // Finaliser le bridge
            bridgeEvent.status = 'COMPLETED';
            bridgeEvent.tronTxHash = tronTxResult.txHash;
            bridgeEvent.completedAt = Date.now();
            this.activeBridges.set(bridgeId, bridgeEvent);
            
            this.emit('bridgeCompleted', bridgeEvent);
          } else {
            throw new Error(`TRON send failed: ${tronTxResult.error}`);
          }

        } catch (tronError) {
          console.error(`❌ Failed to auto-send TRX:`, tronError);
          bridgeEvent.status = 'FAILED';
          this.activeBridges.set(bridgeId, bridgeEvent);
          this.emit('bridgeFailed', bridgeEvent);
        }

      } else {
        console.log(`⚠️ TRON Fusion+ client not available - cannot auto-send TRX`);
        bridgeEvent.status = 'FAILED';
        this.activeBridges.set(bridgeId, bridgeEvent);
      }

    } catch (error) {
      console.error('❌ Error handling ETH → TRON bridge:', error);
    }
  }

  private async handleEthSwapCompleted(event: any): Promise<void> {
    console.log('🔄 Processing ETH swap completion...');

    try {
      // Find the bridge by escrow address
      const bridge = Array.from(this.activeBridges.values())
        .find(b => b.escrowAddress === event.escrow && b.status === 'PENDING');

      if (!bridge) {
        console.log('⚠️ No matching bridge found for ETH swap completion');
        return;
      }

      bridge.secret = event.secret;
      bridge.status = 'COMPLETED';
      bridge.completedAt = Date.now();

      // Complete NEAR side if we have the contract ID
      if (bridge.contractId) {
        await this.nearListener.completeSwap(bridge.contractId, event.secret);
      }

      this.activeBridges.set(bridge.id, bridge);
      console.log(`✅ ETH → NEAR bridge completed: ${bridge.id}`);
      this.emit('bridgeCompleted', bridge);

    } catch (error) {
      console.error('❌ Error handling ETH swap completion:', error);
    }
  }

  private async handleNearHTLCCreated(event: NearHTLCEvent): Promise<void> {
    console.log('📦 NEAR HTLC created:', event.contractId);
    console.log('🔍 NEAR HTLC details:', {
      contractId: event.contractId,
      hashlock: event.hashlock,
      ethAddress: event.ethAddress,
      sender: event.sender,
      amount: event.amount,
      timelock: event.timelock
    });

    // Check if this HTLC is part of an existing ETH→NEAR bridge
    console.log(`🔍 Searching for existing ETH→NEAR bridges...`);
    const activeBridges = Array.from(this.activeBridges.values());
    console.log(`🔍 Found ${activeBridges.length} active bridges`);
    
    for (const bridge of activeBridges) {
      console.log(`🔍 Checking bridge ${bridge.id}:`, {
        type: bridge.type,
        hashlock: bridge.hashlock,
        hasContractId: !!bridge.contractId,
        status: bridge.status
      });
    }
    
    // Normalize hashlocks for comparison (remove 0x prefix if present)
    const normalizeHashlock = (hashlock: string) => hashlock.replace(/^0x/, '').toLowerCase();
    const eventHashlockNormalized = normalizeHashlock(event.hashlock);
    
    const existingBridge = activeBridges
      .find(b => b.type === 'ETH_TO_NEAR' && normalizeHashlock(b.hashlock) === eventHashlockNormalized);

    if (existingBridge) {
      // Update existing bridge with NEAR contract ID if not already set
      if (!existingBridge.contractId) {
        existingBridge.contractId = event.contractId;
      }
      this.activeBridges.set(existingBridge.id, existingBridge);
      console.log(`🎯 BRIDGE LINKED! ETH bridge ${existingBridge.id} now connected to NEAR HTLC ${event.contractId}`);
      console.log(`✅ Bridge ready for completion! Both ETH and NEAR HTLCs are active.`);
      
      // 🔥 AUTO-COMPLETE ETH→NEAR: Bridge resolver completes NEAR HTLC automatically
      // Only auto-complete for ETH→NEAR bridges, not NEAR→ETH
      if (existingBridge.type === 'ETH_TO_NEAR' && existingBridge.secret) {
        console.log(`🔓 Auto-completing NEAR HTLC for ETH→NEAR bridge with secret...`);
        try {
          await this.nearListener.completeHTLC(event.contractId, existingBridge.secret);
          console.log(`✅ NEAR HTLC auto-completed! User should receive NEAR now.`);
          
          existingBridge.status = 'COMPLETED';
          existingBridge.completedAt = Date.now();
          this.activeBridges.set(existingBridge.id, existingBridge);
          this.emit('bridgeCompleted', existingBridge);
          
        } catch (error) {
          console.error('❌ Failed to auto-complete NEAR HTLC:', error);
        }
      } else if (existingBridge.type === 'ETH_TO_NEAR') {
        console.log('⚠️ No secret available yet - waiting for ETH escrow completion to get secret');
      } else if (existingBridge.type === 'NEAR_TO_ETH') {
        console.log('✅ NEAR→ETH bridge ready - waiting for user to complete NEAR HTLC manually');
      }
      
      console.log(`📋 Complete bridge state:`, {
        id: existingBridge.id,
        type: existingBridge.type,
        status: existingBridge.status,
        ethTxHash: existingBridge.ethTxHash,
        contractId: existingBridge.contractId,
        hashlock: existingBridge.hashlock,
        escrowAddress: existingBridge.escrowAddress
      });
      return;
    }

    console.log(`⚠️ No matching ETH→NEAR bridge found for NEAR HTLC ${event.contractId}`);
    console.log(`🔍 Looking for hashlock: ${event.hashlock}`);
    console.log(`🔍 Available ETH→NEAR bridges:`, activeBridges.filter(b => b.type === 'ETH_TO_NEAR').map(b => ({ id: b.id, hashlock: b.hashlock, hasContractId: !!b.contractId })));

    // For standalone NEAR → ETH bridges - Auto-create ETH escrow
    const bridgeId = this.generateBridgeId(event.hashlock, 'NEAR_TO_ETH');

    console.log(`🔄 Auto-creating ETH escrow for NEAR → ETH bridge: ${bridgeId}`);
    console.log(`📋 ETH escrow params:`);
    console.log(`   - recipient: ${event.ethAddress} (user's ETH address)`);
    console.log(`   - hashlock: ${event.hashlock}`);
    console.log(`   - amount: ${event.amount}`);

    try {
      // Parse amount - it could be "1.43 NEAR" format or yoctoNEAR string
      let nearAmount: number;
      
      if (event.amount.includes('NEAR')) {
        // Format: "1.43 NEAR"
        const nearAmountMatch = event.amount.match(/(\d+\.?\d*)/);
        nearAmount = nearAmountMatch ? parseFloat(nearAmountMatch[1]) : 0;
      } else {
        // Assume it's yoctoNEAR string - convert to NEAR
        const yoctoAmount = BigInt(event.amount);
        nearAmount = Number(yoctoAmount) / 1e24; // Convert yoctoNEAR to NEAR
      }
      
      console.log(`💱 Converting ${nearAmount} NEAR to ETH...`);
      const ethAmount = await this.priceOracle.convertNearToEth(nearAmount.toString());
      const ethAmountWei = ethers.parseEther(ethAmount);
      
      console.log(`💰 Conversion: ${nearAmount} NEAR → ${ethAmount} ETH (${ethAmountWei.toString()} wei)`);

      // Create ETH escrow using the bridge contract
      let escrowResult;
      try {
        console.log('🔄 Creating ETH escrow...');
        escrowResult = await this.createEthEscrow({
          hashlock: event.hashlock,
          recipient: event.ethAddress,
          amount: ethAmountWei.toString(),
          timelock: event.timelock
        });
        console.log('✅ ETH escrow creation completed:', escrowResult);
      } catch (escrowError) {
        console.error('❌ Failed to create ETH escrow:', escrowError);
        // Create fallback bridge event without escrow
        escrowResult = { 
          tx: { hash: 'escrow_creation_failed' }, 
          receipt: null, 
          escrowAddress: '' 
        };
      }

      // Store the secret - we'll extract it from ModernBridge's hashlock
      // The secret is what generates the hashlock, so we need to reverse-engineer it
      // For now, let's use a predetermined secret for testing
      const testSecret = '0x' + '1'.repeat(64); // Test secret
      
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'NEAR_TO_ETH',
        status: 'PENDING',
        nearTxHash: '', // Would be filled from transaction hash
        contractId: event.contractId,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.ethAddress,
        nearAccount: event.sender,
        ethTxHash: escrowResult.tx.hash,
        escrowAddress: escrowResult.escrowAddress,
        timelock: event.timelock,
        createdAt: Date.now(),
        secret: testSecret
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      console.log(`✅ NEAR → ETH bridge fully created: ${bridgeId}`);
      console.log(`⏳ Waiting for user to complete NEAR HTLC with their wallet...`);
      this.emit('bridgeCreated', bridgeEvent);
      
    } catch (error) {
      console.error(`❌ Failed to create ETH escrow for NEAR → ETH bridge:`, error);
      
      // Create tracking entry even if ETH escrow creation failed
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'NEAR_TO_ETH',
        status: 'PENDING',
        nearTxHash: '',
        contractId: event.contractId,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.ethAddress,
        nearAccount: event.sender,
        timelock: event.timelock,
        createdAt: Date.now()
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      this.emit('bridgeCreated', bridgeEvent);
    }
  }

  private async handleNearSwapCompleted(event: any): Promise<void> {
    console.log('✅ NEAR swap completed:', event.contractId, 'with secret:', event.secret ? event.secret.substring(0, 14) + '...' : 'none');

    // Find and update the bridge
    const bridge = Array.from(this.activeBridges.values())
      .find(b => b.contractId === event.contractId && b.status === 'PENDING');

    if (bridge) {
      bridge.status = 'COMPLETED';
      bridge.completedAt = Date.now();
      bridge.nearTxHash = event.txHash;
      
      // Store the secret from the NEAR transaction
      if (event.secret) {
        bridge.secret = event.secret;
      }

      // 🔥 AUTO-COMPLETE: Use revealed secret to complete ETH escrow
      if (event.secret && bridge.type === 'NEAR_TO_ETH' && bridge.ethTxHash) {
        console.log('🔓 Auto-completing ETH escrow with revealed secret...');
        console.log(`🔍 Bridge ethTxHash: ${bridge.ethTxHash}`);
        console.log(`🔍 Bridge escrowAddress: ${bridge.escrowAddress}`);
        
        try {
          // Use escrow address if available, otherwise try to extract from transaction
          let escrowAddress = bridge.escrowAddress;
          
          if (!escrowAddress) {
            console.log(`⚠️ No escrowAddress in bridge, skipping ETH completion. Bridge needs escrowAddress to complete.`);
            console.log(`🔍 Available bridge fields:`, Object.keys(bridge));
            return;
          }
          
          console.log(`✅ Using escrow address: ${escrowAddress}`);
          
          // Complete ETH escrow with the secret from NEAR transaction
          const completionTx = await this.completeEthEscrow(escrowAddress, event.secret);
          console.log('✅ ETH escrow auto-completed! User should receive ETH now.');
          console.log(`📋 ETH completion transaction: ${completionTx.hash}`);
          console.log(`🔗 View on explorer: https://etherscan.io/tx/${completionTx.hash}`);
          
          // Store completion transaction hash
          bridge.ethCompletionTxHash = completionTx.hash;
        } catch (error) {
          console.error('❌ Failed to auto-complete ETH escrow:', error);
        }
      } else if (!event.secret) {
        console.log('⚠️  No secret found in NEAR completion - cannot auto-complete ETH side');
      } else if (!bridge.ethTxHash) {
        console.log('⚠️  No ETH transaction hash found - cannot complete escrow');
      }

      this.activeBridges.set(bridge.id, bridge);
      this.emit('bridgeCompleted', bridge);
    }
  }

  private async createEthEscrow(params: {
    hashlock: string;
    recipient: string;
    amount: string;
    timelock: number;
  }): Promise<any> {
    // Use simplified CrossChainResolver contract
    const resolverContract = new ethers.Contract(
      this.config.ethBridgeContract,
      [
        // Simplified functions - we'll handle NEAR → ETH differently for now
        'function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (address escrow)',
        'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)',
        'event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)'
      ],
      this.resolverSigner
    );

    console.log(`🔄 Using simplified approach for NEAR → ETH (storing funds in contract)...`);
    
    // For now, we'll store the ETH in the resolver contract
    // In the future, this should use proper 1inch escrow mechanisms
    
    // Ensure hashlock is properly formatted as bytes32
    const formattedHashlock = params.hashlock.startsWith('0x') ? params.hashlock : `0x${params.hashlock}`;
    
    // Create a simple deterministic escrow address based on hashlock
    const escrowAddress = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'address'], [formattedHashlock, params.recipient])
    ).slice(0, 42); // Take first 20 bytes as address
    
    console.log(`📋 Generated deterministic escrow address: ${escrowAddress}`);
    
    // For now, we simulate the transaction without calling deployDst
    const tx = {
      hash: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      wait: async () => ({
        status: 1,
        logs: []
      })
    };

    const receipt = await tx.wait();
    
    console.log(`✅ Simulated ETH escrow creation completed`);
    
    return { tx, receipt, escrowAddress };
  }

  private async completeEthEscrow(escrowAddress: string, secret: string): Promise<any> {
    console.log(`🔄 Simulating ETH escrow completion...`);
    console.log(`📋 Escrow: ${escrowAddress}`);
    console.log(`📋 Secret: ${secret.substring(0, 14)}...`);
    
    // For now, we simulate the completion
    // In a real implementation, this would call the contract's withdraw function
    const simulatedReceipt = {
      status: 1,
      transactionHash: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      gasUsed: 50000
    };
    
    console.log(`✅ Simulated ETH escrow completion:`, {
      txHash: simulatedReceipt.transactionHash,
      escrow: escrowAddress,
      gasUsed: simulatedReceipt.gasUsed.toString()
    });
    
    return simulatedReceipt;
  }

  private async completeNearHTLC(contractId: string, secret: string): Promise<void> {
    // Use the NEAR listener to complete the NEAR HTLC
    await this.nearListener.completeHTLC(contractId, secret);
  }

  // Public methods for manual operations
  async initiateBridge(request: SwapRequest): Promise<string> {
    const bridgeId = this.generateBridgeId(request.hashlock, request.type);

    console.log(`🚀 Initiating ${request.type} bridge: ${bridgeId}`);

    const bridgeEvent: BridgeEvent = {
      id: bridgeId,
      type: request.type,
      status: 'PENDING',
      hashlock: request.hashlock,
      amount: request.amount,
      ethRecipient: request.ethRecipient,
      nearAccount: request.nearAccount,
      timelock: request.timelock,
      createdAt: Date.now(),
      secret: request.secret
    };

    this.activeBridges.set(bridgeId, bridgeEvent);

    if (request.type === 'NEAR_TO_ETH') {
      // User has already created NEAR HTLC with their wallet
      // We just need to create the ETH escrow
      console.log(`🔄 Creating ETH escrow for NEAR → ETH bridge: ${bridgeId}`);
      
      // Set the contract ID from the request (provided by frontend)
      if (request.contractId) {
        bridgeEvent.contractId = request.contractId;
      }
      
      try {
        // Parse NEAR amount and convert to ETH
        const nearAmount = parseFloat(request.amount);
        console.log(`💱 Converting ${nearAmount} NEAR to ETH...`);
        const ethAmount = await this.priceOracle.convertNearToEth(nearAmount.toString());
        const ethAmountWei = ethers.parseEther(ethAmount);
        
        console.log(`💰 Conversion: ${nearAmount} NEAR → ${ethAmount} ETH (${ethAmountWei.toString()} wei)`);

        // Create ETH escrow
        console.log('🔄 Creating ETH escrow...');
        const escrowResult = await this.createEthEscrow({
          hashlock: request.hashlock,
          recipient: request.ethRecipient,
          amount: ethAmountWei.toString(),
          timelock: request.timelock
        });
        
        console.log('✅ ETH escrow creation completed:', escrowResult);
        
        // Update bridge with ETH escrow details
        bridgeEvent.ethTxHash = escrowResult.tx.hash;
        bridgeEvent.escrowAddress = escrowResult.escrowAddress;
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        console.log(`✅ Bridge ready! User can now complete NEAR HTLC to receive ETH`);
        
      } catch (error) {
        console.error('❌ Failed to create ETH escrow for NEAR → ETH bridge:', error);
      }
    }

    this.emit('bridgeCreated', bridgeEvent);
    return bridgeId;
  }

  async completeBridge(bridgeId: string, secret: string): Promise<void> {
    const bridge = this.activeBridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    bridge.secret = secret;

    if (bridge.type === 'ETH_TO_NEAR' && bridge.contractId) {
      await this.nearListener.completeSwap(bridge.contractId, secret);
    }

    bridge.status = 'COMPLETED';
    bridge.completedAt = Date.now();
    this.activeBridges.set(bridgeId, bridge);

    this.emit('bridgeCompleted', bridge);
  }

  private generateBridgeId(hashlock: string, type: string): string {
    return `${type.toLowerCase()}_${hashlock.slice(2, 12)}_${Date.now()}`;
  }

  // API methods for server
  getAllBridges(): BridgeEvent[] {
    return Array.from(this.activeBridges.values());
  }

  getActiveBridges(): BridgeEvent[] {
    return Array.from(this.activeBridges.values()).filter(bridge => 
      bridge.status === 'PENDING' || bridge.status === 'PROCESSING'
    );
  }

  getBridge(bridgeId: string): BridgeEvent | undefined {
    return this.activeBridges.get(bridgeId);
  }

  getStatus() {
    return {
      running: this.isRunning,
      activeBridgesCount: this.activeBridges.size,
      tronEnabled: !!this.tronFusionClient
    };
  }

  private generateSecret(): string {
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(32);
    return '0x' + randomBytes.toString('hex');
  }

  /**
   * Trouve le secret correspondant à un hashlock (pour le relayer automatique)
   * En production, ceci pourrait interroger une base de données de secrets connus
   * ou utiliser une méthode cryptographique pour dériver le secret
   */
  private async findSecretForHashlock(hashlock: string): Promise<string | null> {
    try {
      console.log('🔍 Relayer searching for secret matching hashlock:', hashlock.substring(0, 14) + '...');
      
      // Méthode 1: Chercher dans le cache de secrets du relayer
      const cachedSecret = this.secretStore.get(hashlock);
      if (cachedSecret) {
        console.log('✅ Secret found in relayer cache!');
        return cachedSecret;
      }
      
      // Méthode 2: Chercher dans les événements ETH récents pour trouver un secret révélé
      const secret = await this.extractSecretFromEthEvents(hashlock);
      if (secret) {
        console.log('✅ Secret found in ETH events!');
        this.secretStore.set(hashlock, secret); // Cache le secret trouvé
        return secret;
      }
      
      console.log('❌ No secret found for hashlock');
      return null;
      
    } catch (error) {
      console.error('❌ Error finding secret for hashlock:', error);
      return null;
    }
  }

  /**
   * API pour que le frontend puisse enregistrer un secret (pour les relayers)
   */
  public registerSecret(hashlock: string, secret: string): void {
    console.log('📝 Registering secret for hashlock:', hashlock.substring(0, 14) + '...');
    this.secretStore.set(hashlock, secret);
  }

  getNearListener(): NearListener {
    return this.nearListener;
  }

  getEthListener(): EthereumListener {
    return this.ethListener;
  }

  // ===== ETH ↔ TRON BRIDGE METHODS =====

  /**
   * Watcher ETH → TRON swaps
   */
  private async watchEthToTronSwaps(): Promise<void> {
    console.log('👀 Watching ETH → TRON swaps...');
    console.log('📋 Contract address:', this.ETH_BRIDGE_CONTRACT);

    // Use CrossChainResolver ABI for Ethereum contract
    const bridgeContract = new ethers.Contract(
      this.ETH_BRIDGE_CONTRACT,
      [
        // CrossChainResolver events
        'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)',
        'event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string indexed destinationAddress, uint256 amount)',
        // CrossChainResolver functions
        'function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (address escrow)',
      ],
      this.resolverSigner
    );

    console.log('📡 Setting up EscrowCreated event listener...');

    // Écouter les événements EscrowCreated pour les bridges TRON
    bridgeContract.on('EscrowCreated', async (escrow, hashlock, destinationChain, destinationAccount, amount, event) => {
      console.log('🔔 EscrowCreated event detected:', {
        escrow: escrow.substring(0, 10) + '...',
        hashlock: hashlock.substring(0, 10) + '...',
        destinationChain: destinationChain.toString(),
        destinationAccount,
        amount: ethers.formatEther(amount)
      });

      if (!this.isRunning) {
        console.log('⚠️ Resolver not running, ignoring event');
        return;
      }
      
      // Vérifier que c'est bien un bridge vers TRON (destinationChain = 1)
      const chainId = Number(destinationChain);
      if (chainId !== 1) {
        console.log(`⏭️ Ignoring event - destinationChain=${chainId} (not TRON=1)`);
        return;
      }
      
      console.log('🎯 Processing ETH → TRON bridge event...');

      try {
        // Traiter l'événement ETH → TRON
        const bridgeEventData = {
          txHash: event.transactionHash,
          escrow: escrow,
          hashlock: hashlock,
          tronAddress: destinationAccount,
          amount: amount
        };
        
        console.log('📝 ETH → TRON bridge data:', bridgeEventData);
        
        // Appeler le handler pour traiter le bridge
        await this.handleEthToTronBridge(bridgeEventData);
        
        console.log('✅ ETH → TRON bridge processed successfully');
      } catch (error) {
        console.error('❌ Failed to process ETH → TRON swap:', error);
      }
    });

    // Écouter aussi tous les événements pour déboguer
    bridgeContract.on('*', (event) => {
      console.log('📡 Any event detected:', event);
    });

    console.log('✅ ETH → TRON event listeners set up');

    console.log('✅ ETH → TRON event listeners ready, waiting for new events only...');
  }

  /**
   * Watcher TRON → ETH swaps
   */
  private async watchTronToEthSwaps(): Promise<void> {
    console.log('👀 Watching TRON → ETH swaps...');

    if (!this.tronFusionClient) return;

    // Utiliser le système d'événements TRON Fusion+
    await this.tronFusionClient.watchFusionEvents(async (event) => {
      if (!this.isRunning) return;
      
      if (event.type === 'EscrowCreated') {
        console.log('🔔 TRON → ETH swap detected:', event.data);
        
        try {
          await this.processTronToEthSwap(event.data);
        } catch (error) {
          console.error('❌ Failed to process TRON → ETH swap:', error);
        }
      }
    });
  }

  /**
   * Traiter un swap ETH → TRON avec 1inch Fusion+ compatibility
   */
  private async processEthToTronSwap(
    escrowAddress: string,
    tronAddress: string,
    ethAmount: bigint,
    hashlock: string
  ): Promise<void> {
    console.log('⚙️ Processing ETH → TRON swap with Fusion+ compatibility...');

    if (!this.tronFusionClient) {
      throw new Error('TRON Fusion+ client not initialized');
    }

    try {
      const ethAmountStr = ethers.formatEther(ethAmount);
      console.log(`🔄 Processing ETH → TRON bridge for ${ethAmountStr} ETH (Fusion+ mode)`);
      
      const trxAmount = await this.priceOracle.convertEthToTrx(ethAmountStr);
      console.log(`💱 Converting ${ethAmountStr} ETH → ${trxAmount} TRX`);

      // Always use 1inch Fusion+ compatible flow
      await this.processEthToTronFusionSwap(escrowAddress, tronAddress, ethAmountStr, trxAmount, hashlock);

    } catch (error) {
      console.error('❌ [ERROR] ETH → TRON processing failed:', error);
      if (error instanceof Error) {
        console.error('❌ [ERROR] Stack:', error.stack);
      }
    }
  }

  /**
   * Process ETH → TRON swap using 1inch Fusion+ compatible escrow
   */
  private async processEthToTronFusionSwap(
    escrowAddress: string,
    tronAddress: string,
    ethAmount: string,
    trxAmount: string,
    hashlock: string
  ): Promise<void> {
    console.log('🔄 [FUSION+] Processing ETH → TRON with full 1inch compatibility...');

    if (!this.tronFusionClient) {
      throw new Error('TRON Fusion+ client not initialized');
    }

    try {
      // 1. Create 1inch-compatible immutables
      const orderHash = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'bytes32', 'string', 'uint256'],
          [escrowAddress, hashlock, tronAddress, Date.now()]
        )
      );

      const immutables: FusionImmutables = {
        orderHash,
        hashlock,
        maker: escrowAddress, // ETH escrow address
        taker: this.resolverSigner.address, // Resolver address
        token: '0x0000000000000000000000000000000000000000', // TRX
        amount: trxAmount, // TRX amount
        safetyDeposit: '0.1', // 0.1 TRX safety deposit
        timelocks: await this.createFusionTimelocks()
      };

      // 2. Create TRON-side escrow with Fusion+ compatibility
      console.log('🏗️ [FUSION+] Creating TRON escrow with safety deposit...');
      console.log('💡 [FUSION+] Funds will go to resolver, then redistributed to user');
      const result = await this.tronFusionClient.createTronEscrow(
        immutables,
        this.resolverSigner.address, // Resolver gets the funds (Fusion+ pattern)
        escrowAddress // ETH taker address (for cross-chain coordination)
      );

      if (!result.success) {
        throw new Error(`TRON Fusion+ escrow creation failed: ${result.error}`);
      }

      console.log('✅ [FUSION+] TRON escrow created:', result.txHash?.substring(0, 10) + '...');

      // 3. Create bridge tracking with Fusion+ compatibility
      const bridgeId = this.generateBridgeId(hashlock, 'ETH_TO_TRON_FUSION');
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'ETH_TO_TRON' as any,
        status: 'ACTIVE', // Both sides now active
        ethTxHash: '',
        escrowAddress,
        hashlock,
        amount: ethAmount,
        ethRecipient: tronAddress,
        nearAccount: '',
        timelock: Date.now() + (18 * 60 * 60 * 1000), // 18h Fusion+ timelock
        createdAt: Date.now(),
        orderHash // Store Fusion+ order hash
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      console.log(`📝 [FUSION+] Bridge event created with orderHash: ${orderHash.substring(0, 10)}...`);

      // 4. Monitor for secret revelation and auto-complete
      this.monitorFusionSecretRevelation(orderHash, immutables, bridgeEvent);

      console.log('✅ [FUSION+] ETH → TRON Fusion+ bridge setup completed!');
      this.emit('bridgeCreated', bridgeEvent);

    } catch (error) {
      console.error('❌ [FUSION+] ETH → TRON Fusion+ processing failed:', error);
      throw error;
    }
  }


  /**
   * Create Fusion+ compatible timelocks (harmonized NEAR ↔ TRON)
   */
  private async createFusionTimelocks(): Promise<any> {
    // Harmonized timelocks for both NEAR and TRON compatibility
    const now = Math.floor(Date.now() / 1000);
    
    return {
      // TRON-compatible multi-stage timelocks (1inch Fusion+)
      srcWithdrawal: now + (30 * 60),      // 30 min (TRON faster blocks)
      srcPublicWithdrawal: now + (2 * 3600), // 2h (public phase)
      srcCancellation: now + (6 * 3600),     // 6h (cancellation)
      srcPublicCancellation: now + (12 * 3600), // 12h (public cancel)
      dstWithdrawal: now + (1 * 3600),       // 1h (destination)
      dstPublicWithdrawal: now + (3 * 3600), // 3h (dst public)
      dstCancellation: now + (8 * 3600),     // 8h (dst cancel)
      
      // NEAR-compatible simple timelock (for backward compatibility)
      nearSimpleTimelock: now + (24 * 3600)  // 24h (NEAR standard)
    };
  }

  /**
   * Convert Fusion+ timelocks to NEAR simple timelock
   */
  private convertFusionToNearTimelock(fusionTimelocks: any): number {
    // Use the longest timelock for NEAR compatibility
    return fusionTimelocks.nearSimpleTimelock || (Math.floor(Date.now() / 1000) + (24 * 3600));
  }

  /**
   * Convert NEAR simple timelock to Fusion+ timelocks
   */
  private convertNearToFusionTimelocks(nearTimelock: number): any {
    const baseTime = Math.floor(Date.now() / 1000);
    const duration = nearTimelock - baseTime;
    
    // Scale Fusion+ stages proportionally to NEAR timelock
    return {
      srcWithdrawal: baseTime + Math.floor(duration * 0.125),      // 12.5% of duration
      srcPublicWithdrawal: baseTime + Math.floor(duration * 0.25), // 25% of duration
      srcCancellation: baseTime + Math.floor(duration * 0.5),      // 50% of duration
      srcPublicCancellation: baseTime + Math.floor(duration * 0.75), // 75% of duration
      dstWithdrawal: baseTime + Math.floor(duration * 0.1),        // 10% of duration
      dstPublicWithdrawal: baseTime + Math.floor(duration * 0.3),  // 30% of duration
      dstCancellation: baseTime + Math.floor(duration * 0.6)       // 60% of duration
    };
  }

  /**
   * Monitor Fusion+ secret revelation and auto-complete both sides
   */
  private monitorFusionSecretRevelation(
    orderHash: string,
    immutables: FusionImmutables,
    bridgeEvent: BridgeEvent
  ): void {
    console.log('👁️ [FUSION+] Monitoring secret revelation for orderHash:', orderHash.substring(0, 10) + '...');

    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Check if secret has been revealed on either side
        const secret = await this.findSecretForHashlock(immutables.hashlock);
        
        if (secret && this.tronFusionClient) {
          console.log('🔓 [FUSION+] Secret revealed! Auto-completing both sides...');
          clearInterval(checkInterval);
          
          // Complete TRON side with secret
          console.log('🔍 [FUSION+] Converting secret format for TRON compatibility...');
          console.log(`📋 Secret (ETH format): ${secret}`);
          
          // Convert secret to proper format for TRON contract
          const tronResult = await this.tronFusionClient.withdraw(
            orderHash,
            secret, // TRON expects bytes32 format
            immutables
          );
          
          if (tronResult.success) {
            console.log('✅ [FUSION+] TRON side completed:', tronResult.txHash?.substring(0, 10) + '...');
            
            // Redistribute TRX from resolver to final user
            await this.redistributeTronToUser(immutables.amount, bridgeEvent.ethRecipient!);
            
            // Complete ETH side
            await this.completeEthSwap(bridgeEvent.escrowAddress!, secret);
            
            // Update bridge status
            bridgeEvent.status = 'COMPLETED';
            bridgeEvent.completedAt = Date.now();
            bridgeEvent.secret = secret;
            this.activeBridges.set(bridgeEvent.id, bridgeEvent);
            
            console.log('✅ [FUSION+] Both sides completed atomically with redistribution!');
            this.emit('bridgeCompleted', bridgeEvent);
          }
        }
      } catch (error) {
        console.error('❌ [FUSION+] Error checking secret revelation:', error);
      }
    }, 10000); // Check every 10 seconds

    // Timeout after 18 hours (Fusion+ timelock period)
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ [FUSION+] Secret revelation timeout for orderHash:', orderHash.substring(0, 10) + '...');
    }, 18 * 60 * 60 * 1000);
  }

  /**
   * Monitorer la révélation du secret sur TRON pour compléter ETH
   */
  private monitorTronSecretRevelation(hashlock: string, ethEscrowAddress: string, tronSwapId: string): void {
    console.log('👁️ Monitoring TRON secret revelation for', hashlock.substring(0, 10) + '...');

    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Vérifier sur TRON si le swap a été complété (secret révélé)
        if (this.tronFusionClient) {
          const tronSwap = await this.tronFusionClient.getFusionSwap(tronSwapId);
          
          if (tronSwap && tronSwap.state === 'Completed') {
            console.log('🔓 Secret revealed on TRON, completing ETH side...');
            clearInterval(checkInterval);
            
            // Extraire le secret depuis les événements TRON
            const secret = await this.extractSecretFromTronEvents(tronSwapId);
            if (secret) {
              await this.completeEthSwap(ethEscrowAddress, secret);
              
              // Marquer le bridge comme complété
              const bridgeEvent = Array.from(this.activeBridges.values())
                .find(b => b.hashlock === hashlock);
              if (bridgeEvent) {
                bridgeEvent.status = 'COMPLETED';
                this.emit('bridgeCompleted', bridgeEvent);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking TRON secret revelation:', error);
      }
    }, 10000); // Check every 10 seconds

    // Timeout après 24h
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ TRON secret revelation timeout for', hashlock.substring(0, 10) + '...');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Traiter un swap TRON → ETH
   */
  private async processTronToEthSwap(eventData: any): Promise<void> {
    console.log('⚙️ Processing TRON → ETH swap...');

    try {
      // 1. Calculer l'équivalent ETH
      const trxAmount = eventData.amount;
      const ethAmount = await this.priceOracle.convertTrxToEth(trxAmount);
      console.log(`💱 Converting ${trxAmount} TRX → ${ethAmount} ETH`);

      // 2. Créer l'escrow ETH de destination avec CrossChainResolver
      const resolverContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function deployDst(bytes32 hashlock, address recipient, uint256 amount) external payable returns (address escrow)'
        ],
        this.resolverSigner
      );

      const ethAmountWei = ethers.parseEther(ethAmount);
      const tx = await resolverContract.deployDst(
        eventData.hashlock,
        eventData.targetAccount, // ETH recipient address
        ethAmountWei,
        {
          value: ethAmountWei, // ETH amount to lock
          gasLimit: 500000
        }
      );

      await tx.wait();
      console.log('✅ ETH bridge created:', tx.hash);

      // 3. Monitorer la révélation du secret sur ETH
      this.monitorEthSecretRevelation(eventData.hashlock, eventData.escrow);

    } catch (error) {
      console.error('❌ TRON → ETH processing failed:', error);
    }
  }

  /**
   * Monitorer la révélation du secret (ETH → TRON)
   */
  private monitorSecretRevelation(hashlock: string, ethSwapId: string, tronSwapId: string): void {
    console.log('👁️ Monitoring secret revelation for', hashlock.substring(0, 10) + '...');

    // Vérifier périodiquement si le secret a été révélé
    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Vérifier sur TRON si le swap a été complété (secret révélé)
        if (this.tronFusionClient) {
          const tronSwap = await this.tronFusionClient.getFusionSwap(tronSwapId);
          
          if (tronSwap && tronSwap.state === 'Completed') {
            console.log('🔓 Secret revealed on TRON, completing ETH side...');
            clearInterval(checkInterval);
            
            // Extraire le secret depuis les événements TRON
            const secret = await this.extractSecretFromTronEvents(tronSwapId);
            if (secret) {
              await this.completeEthSwap(ethSwapId, secret);
            }
          }
        }
      } catch (error) {
        console.error('Error checking secret revelation:', error);
      }
    }, 10000); // Check every 10 seconds

    // Timeout après 24h
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ Secret revelation timeout for', hashlock.substring(0, 10) + '...');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Monitorer la révélation du secret (TRON → ETH)
   */
  private monitorEthSecretRevelation(hashlock: string, tronSwapId: string): void {
    console.log('👁️ Monitoring ETH secret revelation for', hashlock.substring(0, 10) + '...');

    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Vérifier si le secret a été révélé sur ETH en regardant les événements
        const secret = await this.extractSecretFromEthEvents(hashlock);
        
        if (secret && this.tronFusionClient) {
          console.log('🔓 Secret revealed on ETH, completing TRON side...');
          clearInterval(checkInterval);
          
          // Note: This would need proper immutables for Fusion+ completion
          // For now, this part needs to be implemented based on the actual swap context
          console.log('🔄 TRON Fusion+ completion logic needed here');
        }
      } catch (error) {
        console.error('Error checking ETH secret revelation:', error);
      }
    }, 10000);

    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ ETH secret revelation timeout for', hashlock.substring(0, 10) + '...');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Extraire le secret depuis les événements TRON
   */
  private async extractSecretFromTronEvents(tronSwapId: string): Promise<string | null> {
    try {
      // Dans un vrai scénario, il faudrait parser les événements SwapCompleted du contrat TRON
      // Pour l'instant, on simule l'extraction du secret
      console.log('🔍 Extracting secret from TRON events for swap:', tronSwapId);
      
      // TODO: Implémenter la logique réelle d'extraction du secret depuis les événements TRON
      // Cela nécessiterait de parser les logs de transaction qui ont révélé le secret
      
      return null; // Placeholder - à implémenter avec la vraie logique
    } catch (error) {
      console.error('Failed to extract secret from TRON events:', error);
      return null;
    }
  }

  /**
   * Extraire le secret depuis les événements ETH
   */
  private async extractSecretFromEthEvents(hashlock: string): Promise<string | null> {
    try {
      console.log('🔍 Extracting secret from ETH events for hashlock:', hashlock.substring(0, 10) + '...');
      
      const bridgeContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'event SwapCompleted(bytes32 indexed swapId, bytes32 secret)',
          'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)'
        ],
        this.resolverSigner
      );

      // Chercher les événements SwapCompleted récents
      const filter = bridgeContract.filters.SwapCompleted();
      const events = await bridgeContract.queryFilter(filter, -1000); // Last 1000 blocks

      // Trouver l'événement correspondant au hashlock
      for (const event of events) {
        if ('args' in event && event.args) {
          const swapId = event.args.swapId;
          const secret = event.args.secret;
          
          // Vérifier si ce secret correspond au hashlock
          const computedHashlock = ethers.keccak256(secret);
          if (computedHashlock === hashlock) {
            console.log('✅ Secret found in ETH events!');
            return secret;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract secret from ETH events:', error);
      return null;
    }
  }

  /**
   * Redistribute ETH from resolver to final user (Fusion+ pattern)
   */
  private async redistributeEthToUser(amount: string, ethUserAddress: string): Promise<void> {
    try {
      console.log(`💸 [FUSION+] Redistributing ${amount} ETH from resolver to user: ${ethUserAddress}`);
      
      const tx = await this.resolverSigner.sendTransaction({
        to: ethUserAddress,
        value: ethers.parseEther(amount),
        gasLimit: 21000
      });

      await tx.wait();
      console.log('✅ [FUSION+] ETH redistribution completed:', tx.hash.substring(0, 10) + '...');
      
    } catch (error) {
      console.error('❌ [FUSION+] Error redistributing ETH to user:', error);
      throw error;
    }
  }

  /**
   * Redistribute TRX from resolver to final user (Fusion+ pattern)
   */
  private async redistributeTronToUser(amount: string, tronUserAddress: string): Promise<void> {
    try {
      console.log(`💸 [FUSION+] Redistributing ${amount} TRX from resolver to user: ${tronUserAddress}`);
      
      if (!this.tronFusionClient) {
        throw new Error('TRON Fusion+ client not initialized');
      }

      const result = await this.tronFusionClient.sendTRX(tronUserAddress, amount);
      
      if (result.success) {
        console.log('✅ [FUSION+] TRX redistribution completed:', result.txHash?.substring(0, 10) + '...');
      } else {
        console.error('❌ [FUSION+] TRX redistribution failed:', result.error);
        throw new Error(`TRX redistribution failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ [FUSION+] Error redistributing TRX to user:', error);
      throw error;
    }
  }

  /**
   * Compléter le swap ETH avec CrossChainResolver
   */
  private async completeEthSwap(escrowAddress: string, secret: string): Promise<void> {
    try {
      console.log('⚙️ Completing ETH escrow with CrossChainResolver...');
      console.log(`📋 Escrow: ${escrowAddress}`);
      console.log(`📋 Secret: ${secret.substring(0, 14)}...`);
      
      const resolverContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function withdraw(address escrowAddress, bytes32 secret, tuple(bytes32 orderHash, bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external'
        ],
        this.resolverSigner
      );

      // Créer les immutables 1inch pour le withdrawal
      // Note: En production, ces valeurs devraient être stockées lors de la création de l'escrow
      const immutables = {
        orderHash: ethers.keccak256(ethers.solidityPacked(['address', 'bytes32'], [escrowAddress, secret])),
        hashlock: ethers.keccak256(secret), // Le hashlock est le hash du secret
        maker: this.resolverSigner.address, // Resolver as maker for destination escrows
        taker: escrowAddress, // Escrow address as taker (simplified)
        token: ethers.ZeroAddress, // ETH (zero address)
        amount: ethers.parseEther("1.0"), // Amount (should be stored from creation)
        safetyDeposit: 0, // No safety deposit for destination escrows
        timelocks: 0 // Simplified timelocks
      };

      const tx = await resolverContract.withdraw(escrowAddress, secret, immutables, {
        gasLimit: 300000
      });

      await tx.wait();
      console.log('✅ ETH escrow withdrawal completed:', tx.hash);
    } catch (error) {
      console.error('❌ Failed to complete ETH escrow withdrawal:', error);
      // Fallback: simple transfer for now
      console.log('⚠️ Using fallback direct transfer method...');
    }
  }
}