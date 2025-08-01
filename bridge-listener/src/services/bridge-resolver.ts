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
  private readonly ETH_BRIDGE_CONTRACT = '0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149';
  private readonly TRON_BRIDGE_CONTRACT = 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86';

  constructor(private config: ResolverConfig) {
    super();

    this.ethListener = new EthereumListener(config);
    this.nearListener = new NearListener(config);
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

    // Handle ETH swap completion
    this.ethListener.on('swapCompleted', this.handleEthSwapCompleted.bind(this));

    // Handle NEAR HTLC creation
    this.nearListener.on('htlcCreated', this.handleNearHTLCCreated.bind(this));

    // Handle NEAR swap completion
    this.nearListener.on('htlcCompleted', this.handleNearSwapCompleted.bind(this));
  }

  private async handleEthToNearBridge(event: EthEscrowCreatedEvent): Promise<void> {
    console.log('🔄 Processing ETH → NEAR bridge...');

    // 🔥 Éviter les doublons par txHash
    if (this.processedTxHashes.has(event.txHash)) {
      console.log(`⚠️ Transaction ${event.txHash} already processed, skipping...`);
      return;
    }
    this.processedTxHashes.add(event.txHash);

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
        // secret will be provided later when completing
      };

      this.activeBridges.set(bridgeId, bridgeEvent);

      // 📡 MONITORING MODE: Wait for user to create NEAR HTLC with their wallet
      console.log(`📡 Monitoring ETH → NEAR bridge: ${bridgeId}`);
      console.log(`⏳ Waiting for user to create NEAR HTLC with their connected wallet...`);
      console.log(`📋 Expected NEAR HTLC params:`);
      console.log(`   - receiver: ${event.nearAccount} (user's NEAR account)`);
      console.log(`   - hashlock: ${event.hashlock}`);
      console.log(`   - ethAddress: ${event.escrow}`);
      console.log(`   - amount: ${event.amount}`);

      console.log(`✅ ETH side ready, waiting for NEAR side: ${bridgeId}`);
      this.emit('bridgeCreated', bridgeEvent);

    } catch (error) {
      console.error('❌ Error handling ETH → NEAR bridge:', error);
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

    // Check if this HTLC is part of an existing ETH→NEAR bridge
    const existingBridge = Array.from(this.activeBridges.values())
      .find(b => b.type === 'ETH_TO_NEAR' && b.hashlock === event.hashlock && !b.contractId);

    if (existingBridge) {
      // Update existing bridge with NEAR contract ID
      existingBridge.contractId = event.contractId;
      this.activeBridges.set(existingBridge.id, existingBridge);
      console.log(`🎯 BRIDGE LINKED! ETH bridge ${existingBridge.id} now connected to NEAR HTLC ${event.contractId}`);
      console.log(`✅ Bridge ready for completion! Both ETH and NEAR HTLCs are active.`);
      return;
    }

    // For standalone NEAR → ETH bridges - Auto-create ETH escrow
    const bridgeId = this.generateBridgeId(event.hashlock, 'NEAR_TO_ETH');

    console.log(`🔄 Auto-creating ETH escrow for NEAR → ETH bridge: ${bridgeId}`);
    console.log(`📋 ETH escrow params:`);
    console.log(`   - recipient: ${event.ethAddress} (user's ETH address)`);
    console.log(`   - hashlock: ${event.hashlock}`);
    console.log(`   - amount: ${event.amount}`);

    try {
      // Create ETH escrow using the bridge contract
      const tx = await this.createEthEscrow({
        hashlock: event.hashlock,
        recipient: event.ethAddress,
        amount: event.amount,
        timelock: event.timelock
      });

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
        ethTxHash: tx.hash,
        timelock: event.timelock,
        createdAt: Date.now()
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      console.log(`✅ NEAR → ETH bridge fully created: ${bridgeId}`);
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
    console.log('✅ NEAR swap completed:', event.contractId);

    // Find and update the bridge
    const bridge = Array.from(this.activeBridges.values())
      .find(b => b.contractId === event.contractId && b.status === 'PENDING');

    if (bridge) {
      bridge.status = 'COMPLETED';
      bridge.completedAt = Date.now();
      bridge.nearTxHash = event.txHash;

      // 🔥 AUTO-COMPLETE: Reveal secret on ETH side if we have it
      if (bridge.secret && bridge.escrowAddress) {
        console.log('🔓 Auto-completing ETH side with revealed secret...');
        try {
          // Complete ETH escrow with the secret
          await this.completeEthEscrow(bridge.escrowAddress, bridge.secret);
          console.log('✅ ETH escrow auto-completed!');
        } catch (error) {
          console.error('❌ Failed to auto-complete ETH escrow:', error);
        }
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
    // Use the bridge contract to create ETH escrow for NEAR → ETH direction
    const bridgeContract = new ethers.Contract(
      this.config.ethBridgeContract,
      [
        'function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (bytes32 swapId)',
        'function createNEARToETHBridge(bytes32 hashlock, address ethRecipient) external payable returns (bytes32 swapId)'
      ],
      this.resolverSigner
    );

    // For NEAR → ETH, we create an ETH escrow that will pay to the recipient
    const tx = await bridgeContract.createNEARToETHBridge(
      params.hashlock,
      params.recipient,
      {
        value: params.amount, // Bridge-listener pays the ETH
        gasLimit: 500000
      }
    );

    await tx.wait();
    return tx;
  }

  private async completeEthEscrow(escrowAddress: string, secret: string): Promise<void> {
    // Use the resolver signer to complete the ETH escrow
    const escrowContract = new ethers.Contract(
      escrowAddress,
      ['function completeSwap(bytes32 secret) external'],
      this.resolverSigner
    );
    
    const tx = await escrowContract.completeSwap(secret);
    await tx.wait();
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
      // Create NEAR HTLC first
      const contractId = await this.nearListener.createCrossChainHTLC({
        receiver: request.nearAccount,
        hashlock: request.hashlock,
        timelock: request.timelock,
        ethAddress: request.ethRecipient,
        amount: request.amount
      });

      bridgeEvent.contractId = contractId;
      this.activeBridges.set(bridgeId, bridgeEvent);
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

  // Getters
  getBridge(bridgeId: string): BridgeEvent | undefined {
    return this.activeBridges.get(bridgeId);
  }

  getAllBridges(): BridgeEvent[] {
    return Array.from(this.activeBridges.values());
  }

  getActiveBridges(): BridgeEvent[] {
    return this.getAllBridges().filter(b => b.status === 'PENDING');
  }

  getNearListener(): NearListener {
    return this.nearListener;
  }

  getEthListener(): EthereumListener {
    return this.ethListener;
  }

  getStatus() {
    return {
      activeBridges: this.activeBridges.size,
      ethListener: this.ethListener.getStatus(),
      nearListener: this.nearListener.getStatus(),
      resolverAddress: this.resolverSigner.address,
      tronEnabled: !!this.tronFusionClient
    };
  }

  // ===== ETH ↔ TRON BRIDGE METHODS =====

  /**
   * Watcher ETH → TRON swaps
   */
  private async watchEthToTronSwaps(): Promise<void> {
    console.log('👀 Watching ETH → TRON swaps...');
    console.log('📋 Contract address:', this.ETH_BRIDGE_CONTRACT);

    const bridgeContract = new ethers.Contract(
      this.ETH_BRIDGE_CONTRACT,
      [
        'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)',
        'function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (bytes32 swapId)',
        'function completeSwap(bytes32 swapId, bytes32 secret) external'
      ],
      this.resolverSigner
    );

    console.log('📡 Setting up EscrowCreated event listener...');

    // Écouter les événements EscrowCreated pour les bridges TRON (destinationChain = 1)
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
        await this.processEthToTronSwap(escrow, destinationAccount, amount, hashlock);
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
   * Create Fusion+ compatible timelocks
   */
  private async createFusionTimelocks(): Promise<any> {
    // This should match the ETH contract timelock structure
    // Simplified for now - in production, use proper timelock packing
    return {
      srcWithdrawal: Math.floor(Date.now() / 1000) + (2 * 3600),      // 2h
      srcPublicWithdrawal: Math.floor(Date.now() / 1000) + (6 * 3600), // 6h  
      srcCancellation: Math.floor(Date.now() / 1000) + (12 * 3600),    // 12h
      srcPublicCancellation: Math.floor(Date.now() / 1000) + (18 * 3600), // 18h
      dstWithdrawal: Math.floor(Date.now() / 1000) + (1 * 3600),      // 1h
      dstPublicWithdrawal: Math.floor(Date.now() / 1000) + (3 * 3600), // 3h
      dstCancellation: Math.floor(Date.now() / 1000) + (8 * 3600)     // 8h
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
          const tronResult = await this.tronFusionClient.withdraw(
            orderHash,
            secret,
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

      // 2. Créer le swap ETH correspondant
      const ethBridge = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function createSwap(bytes32 hashlock, string calldata targetAccount) external payable returns (bytes32)',
          'function completeSwap(bytes32 swapId, bytes32 secret) external'
        ],
        this.resolverSigner
      );

      const tx = await ethBridge.createSwap(
        eventData.hashlock,
        eventData.targetAccount,
        {
          value: ethers.parseEther(ethAmount),
          gasLimit: 200000
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
   * Compléter le swap ETH
   */
  private async completeEthSwap(ethSwapId: string, secret: string): Promise<void> {
    try {
      console.log('⚙️ Completing ETH swap with secret...');
      
      const bridgeContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function completeSwap(bytes32 swapId, bytes32 secret) external'
        ],
        this.resolverSigner
      );

      const tx = await bridgeContract.completeSwap(ethSwapId, secret, {
        gasLimit: 200000
      });

      await tx.wait();
      console.log('✅ ETH swap completed:', tx.hash);
    } catch (error) {
      console.error('❌ Failed to complete ETH swap:', error);
    }
  }
}