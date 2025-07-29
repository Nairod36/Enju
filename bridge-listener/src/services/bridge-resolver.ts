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

  constructor(private config: ResolverConfig) {
    super();

    this.ethListener = new EthereumListener(config);
    this.nearListener = new NearListener(config);

    // Initialize resolver signer for ETH transactions
    const provider = new ethers.providers.JsonRpcProvider(config.ethRpcUrl);
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
        createdAt: Date.now()
      };

      this.activeBridges.set(bridgeId, bridgeEvent);

      // Create corresponding NEAR HTLC
      const nearContractId = await this.nearListener.createCrossChainHTLC({
        receiver: event.nearAccount,
        hashlock: event.hashlock,
        timelock: bridgeEvent.timelock,
        ethAddress: event.escrow,
        amount: event.amount
      });

      bridgeEvent.contractId = nearContractId;
      this.activeBridges.set(bridgeId, bridgeEvent);

      console.log(`✅ ETH → NEAR bridge created: ${bridgeId}`);
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

    // For NEAR → ETH bridges, we'd create the ETH escrow here
    // This is for reverse direction bridges

    const bridgeId = this.generateBridgeId(event.hashlock, 'NEAR_TO_ETH');

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
      timelock: event.timelock,
      createdAt: Date.now()
    };

    this.activeBridges.set(bridgeId, bridgeEvent);
    this.emit('bridgeCreated', bridgeEvent);
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

      this.activeBridges.set(bridge.id, bridge);
      this.emit('bridgeCompleted', bridge);
    }
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