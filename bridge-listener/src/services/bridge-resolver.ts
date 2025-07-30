import { EventEmitter } from 'events';
import { EthereumListener } from './eth-listener';
import { NearListener } from './near-listener';
import { BridgeEvent, EthEscrowCreatedEvent, NearHTLCEvent, ResolverConfig, SwapRequest } from '../types';
import { ethers } from 'ethers';

export class BridgeResolver extends EventEmitter {
  private ethListener: EthereumListener;
  private nearListener: NearListener;
  private activeBridges: Map<string, BridgeEvent> = new Map();
  private resolverSigner: ethers.Wallet;
  private ethToNearMap = new Map<string, string>();
  private processedTxHashes = new Set<string>(); // 🔥 Cache pour éviter les doublons

  constructor(private config: ResolverConfig) {
    super();

    this.ethListener = new EthereumListener(config);
    this.nearListener = new NearListener(config);

    // Initialize resolver signer for ETH transactions
    const provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.resolverSigner = new ethers.Wallet(config.ethPrivateKey, provider);

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

    await this.ethListener.startListening();
    await this.nearListener.startListening();

    console.log('✅ Bridge Resolver is running');
  }

  async stop(): Promise<void> {
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
      resolverAddress: this.resolverSigner.address
    };
  }
}