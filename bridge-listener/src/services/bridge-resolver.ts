import { EventEmitter } from 'events';
import { EthereumListener } from './eth-listener';
import { NearListener } from './near-listener';
import { TronClient } from './tron-client';
import { PriceOracle } from './price-oracle';
import { BridgeEvent, EthEscrowCreatedEvent, NearHTLCEvent, ResolverConfig, SwapRequest } from '../types';
import { ethers } from 'ethers';

export class BridgeResolver extends EventEmitter {
  private ethListener: EthereumListener;
  private nearListener: NearListener;
  private tronClient?: TronClient;
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

    // Initialiser TRON si les variables d'environnement sont présentes
    if (process.env.TRON_PRIVATE_KEY && process.env.TRON_FULL_HOST && process.env.TRON_BRIDGE_CONTRACT) {
      const tronConfig = {
        privateKey: process.env.TRON_PRIVATE_KEY,
        fullHost: process.env.TRON_FULL_HOST,
        bridgeContract: process.env.TRON_BRIDGE_CONTRACT,
        chainId: process.env.TRON_CHAIN_ID || '2'
      };
      this.tronClient = new TronClient(tronConfig);
      console.log('✅ TRON client initialized in BridgeResolver');
    } else {
      console.log('⚠️ TRON configuration missing, ETH ↔ TRON bridges disabled');
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
    if (this.tronClient) {
      console.log('🚀 Starting ETH ↔ TRON watchers...');
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
      tronEnabled: !!this.tronClient
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

    // Vérifier les événements récents (derniers 100 blocs) au cas où on aurait raté quelque chose
    try {
      console.log('🔍 Checking for recent ETH → TRON events...');
      const latestBlock = await this.ethProvider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 500);
      
      console.log(`📊 Scanning blocks ${fromBlock} to ${latestBlock} for EscrowCreated events...`);
      
      const filter = bridgeContract.filters.EscrowCreated();
      const events = await bridgeContract.queryFilter(filter, fromBlock, latestBlock);
      
      console.log(`📋 Found ${events.length} EscrowCreated events in recent blocks`);
      
      for (const event of events) {
        if ('args' in event && event.args) {
          const [escrow, hashlock, destinationChain, destinationAccount, amount] = event.args;
          console.log(`📝 Event: escrow=${escrow.substring(0,10)}... destinationChain=${destinationChain} (type: ${typeof destinationChain}) account=${destinationAccount} amount=${ethers.formatEther(amount)} ETH`);
          
          // Convertir destinationChain en nombre pour comparaison
          const chainId = Number(destinationChain);
          console.log(`🔍 Converted destinationChain: ${chainId} (TRON=1)`);
          
          if (chainId === 1) {
            console.log('🎯 Found recent TRON bridge event, processing...');
            try {
              await this.processEthToTronSwap(escrow, destinationAccount, amount, hashlock);
            } catch (error) {
              console.error('❌ Failed to process recent ETH → TRON event:', error);
            }
          } else {
            console.log(`⏭️ Skipping event - chainId=${chainId} (not TRON=1)`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to check recent events:', error);
    }
  }

  /**
   * Watcher TRON → ETH swaps
   */
  private async watchTronToEthSwaps(): Promise<void> {
    console.log('👀 Watching TRON → ETH swaps...');

    if (!this.tronClient) return;

    // Utiliser le système d'événements Tron
    this.tronClient.watchBridgeEvents(async (event) => {
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
   * Traiter un swap ETH → TRON
   */
  private async processEthToTronSwap(
    escrowAddress: string,
    tronAddress: string,
    ethAmount: bigint,
    hashlock: string
  ): Promise<void> {
    console.log('⚙️ Processing ETH → TRON swap...');

    if (!this.tronClient) {
      throw new Error('TRON client not initialized');
    }

    try {
      // 1. Calculer l'équivalent TRX
      const ethAmountStr = ethers.formatEther(ethAmount);
      console.log(`🔄 Processing ETH → TRON bridge for ${ethAmountStr} ETH`);
      
      const trxAmount = await this.priceOracle.convertEthToTrx(ethAmountStr);
      console.log(`💱 Converting ${ethAmountStr} ETH → ${trxAmount} TRX`);

      // 2. SÉCURITÉ CRITIQUE: Vérifier le secret AVANT d'envoyer les TRX
      console.log('🔑 [SECURITY] Verifying secret before sending TRX...');
      const secret = await this.findSecretForHashlock(hashlock);
      
      if (!secret) {
        console.error('❌ [SECURITY] No valid secret found for hashlock - BLOCKING TRX transfer');
        console.error('❌ [SECURITY] This prevents unauthorized TRX transfers');
        
        // Créer bridge event en état FAILED
        const bridgeId = this.generateBridgeId(hashlock, 'ETH_TO_TRON');
        const bridgeEvent: BridgeEvent = {
          id: bridgeId,
          type: 'ETH_TO_TRON' as any,
          status: 'FAILED',
          ethTxHash: '',
          escrowAddress,
          hashlock,
          amount: ethAmountStr,
          ethRecipient: tronAddress,
          nearAccount: '',
          timelock: Date.now() + (24 * 60 * 60 * 1000),
          createdAt: Date.now(),
        };
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        throw new Error('Secret not found - bridge rejected for security');
      }

      console.log('✅ [SECURITY] Valid secret found, proceeding with TRX transfer');

      // 3. Créer un bridge event pour le tracking
      const bridgeId = this.generateBridgeId(hashlock, 'ETH_TO_TRON');
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'ETH_TO_TRON' as any,
        status: 'PROCESSING',
        ethTxHash: '',
        escrowAddress,
        hashlock,
        amount: ethAmountStr,
        ethRecipient: tronAddress,
        nearAccount: '',
        timelock: Date.now() + (24 * 60 * 60 * 1000),
        createdAt: Date.now(),
        secret: secret
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      console.log(`📝 Bridge event created: ${bridgeId}`);

      // 4. Envoyer les TRX à l'utilisateur (sécurisé par la vérification du secret)
      console.log(`💸 [AUTHORIZED] Sending ${trxAmount} TRX to ${tronAddress}...`);
      
      const tronResult = await this.tronClient.sendTRX(tronAddress, trxAmount);
      console.log(`💸 [DEBUG] TRON send result:`, tronResult);

      if (!tronResult.success) {
        console.error(`❌ [CRITICAL] TRON transfer failed: ${tronResult.error}`);
        bridgeEvent.status = 'FAILED';
        this.activeBridges.set(bridgeId, bridgeEvent);
        throw new Error(`TRON transfer failed: ${tronResult.error}`);
      }

      console.log('✅ [SUCCESS] TRX sent to user:', tronResult.txHash?.substring(0, 10) + '...');
      console.log('🔗 [SUCCESS] TRON TX: https://shasta.tronscan.org/#/transaction/' + tronResult.txHash);

      // 5. Compléter le côté ETH avec le secret vérifié
      console.log('🔓 Completing ETH swap with verified secret...');
      await this.completeEthSwap(escrowAddress, secret);

      // 6. Marquer le bridge comme complété
      bridgeEvent.status = 'COMPLETED';
      bridgeEvent.completedAt = Date.now();
      this.activeBridges.set(bridgeId, bridgeEvent);
      
      console.log('✅ [FINAL] ETH → TRON bridge completed securely!');
      this.emit('bridgeCompleted', bridgeEvent);

    } catch (error) {
      console.error('❌ [ERROR] ETH → TRON processing failed:', error);
      if (error instanceof Error) {
        console.error('❌ [ERROR] Stack:', error.stack);
      }
    }
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
        if (this.tronClient) {
          const tronSwap = await this.tronClient.getSwap(tronSwapId);
          
          if (tronSwap && tronSwap.completed) {
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
        if (this.tronClient) {
          const tronSwap = await this.tronClient.getSwap(tronSwapId);
          
          if (tronSwap.completed) {
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
        
        if (secret && this.tronClient) {
          console.log('🔓 Secret revealed on ETH, completing TRON side...');
          clearInterval(checkInterval);
          
          // Compléter le côté TRON
          await this.tronClient.completeSwap(tronSwapId, secret);
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