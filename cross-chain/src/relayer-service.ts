import { EventEmitter } from 'events';
import { CrossChainEventMonitor, CrossChainEvent } from './event-monitor';
import { InchFusionResolver } from './inch-fusion-resolver';
import { InchFusionTypes } from './types';

interface PendingSwap {
  swapId: string;
  hashlock: string;
  fromChain: 'ethereum' | 'tron' | 'near';
  toChain: 'ethereum' | 'tron' | 'near';
  amount: string;
  userAddress: string;
  targetAddress: string;
  timelock: number;
  status: 'created' | 'locked' | 'completed' | 'failed' | 'refunded';
  secret?: string;
  createdAt: number;
  lastUpdate: number;
}

export class CrossChainRelayerService extends EventEmitter {
  private eventMonitor: CrossChainEventMonitor;
  private resolver: InchFusionResolver;
  private pendingSwaps = new Map<string, PendingSwap>();
  private isRunning = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(private config: InchFusionTypes.Config) {
    super();
    this.eventMonitor = new CrossChainEventMonitor(config);
    this.resolver = new InchFusionResolver(config);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Relayer service already running');
      return;
    }

    console.log('🚀 Starting Cross-Chain Relayer Service...');
    
    // Initialize resolver
    await this.resolver.initialize();
    
    // Start event monitoring
    await this.eventMonitor.start();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Start processing loop
    this.startProcessingLoop();
    
    this.isRunning = true;
    console.log('✅ Cross-Chain Relayer Service started successfully');
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Cross-Chain Relayer Service...');
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    await this.eventMonitor.stop();
    console.log('✅ Relayer Service stopped');
  }

  private setupEventHandlers(): void {
    this.eventMonitor.on('event', (event: CrossChainEvent) => {
      this.handleCrossChainEvent(event);
    });
  }

  private async handleCrossChainEvent(event: CrossChainEvent): Promise<void> {
    console.log(`📡 Processing ${event.type} event from ${event.chain}`);
    
    try {
      switch (event.type) {
        case 'EscrowCreated':
          await this.handleEscrowCreated(event);
          break;
          
        case 'SecretRevealed':
          await this.handleSecretRevealed(event);
          break;
          
        case 'SwapCompleted':
          await this.handleSwapCompleted(event);
          break;
          
        case 'SwapRefunded':
          await this.handleSwapRefunded(event);
          break;
          
        default:
          console.log(`Unknown event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error handling ${event.type} event:`, error);
      this.emit('error', { event, error });
    }
  }

  private async handleEscrowCreated(event: CrossChainEvent): Promise<void> {
    const { escrow, hashlock, maker } = event.data;
    
    // Create pending swap record
    const swapId = this.generateSwapId(event.chain, hashlock);
    const pendingSwap: PendingSwap = {
      swapId,
      hashlock,
      fromChain: event.chain,
      toChain: this.determineTargetChain(event), // Logic to determine target
      amount: '0', // Would be extracted from event
      userAddress: maker,
      targetAddress: '', // Would be determined from swap request
      timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h default
      status: 'created',
      createdAt: event.timestamp,
      lastUpdate: event.timestamp
    };
    
    this.pendingSwaps.set(swapId, pendingSwap);
    console.log(`📝 Registered pending swap: ${swapId}`);
    
    // Trigger cross-chain response
    await this.initiateCrossChainResponse(pendingSwap);
  }

  private async handleSecretRevealed(event: CrossChainEvent): Promise<void> {
    const { escrow, secret } = event.data;
    
    // Find associated swap
    const swap = this.findSwapByEscrow(escrow);
    if (!swap) {
      console.log(`No pending swap found for escrow: ${escrow}`);
      return;
    }
    
    // Update swap with secret
    swap.secret = secret;
    swap.status = 'completed';
    swap.lastUpdate = event.timestamp;
    
    console.log(`🔓 Secret revealed for swap: ${swap.swapId}`);
    
    // Complete the other side of the swap
    await this.completeCrossChainSwap(swap);
  }

  private async handleSwapCompleted(event: CrossChainEvent): Promise<void> {
    const { swapId, secret } = event.data;
    
    const swap = this.pendingSwaps.get(swapId);
    if (swap) {
      swap.status = 'completed';
      swap.secret = secret;
      swap.lastUpdate = event.timestamp;
      
      console.log(`✅ Swap completed: ${swapId}`);
      this.emit('swapCompleted', swap);
    }
  }

  private async handleSwapRefunded(event: CrossChainEvent): Promise<void> {
    const { swapId, user } = event.data;
    
    const swap = this.pendingSwaps.get(swapId);
    if (swap) {
      swap.status = 'refunded';
      swap.lastUpdate = event.timestamp;
      
      console.log(`🔄 Swap refunded: ${swapId}`);
      this.emit('swapRefunded', swap);
    }
  }

  private async initiateCrossChainResponse(swap: PendingSwap): Promise<void> {
    console.log(`🔄 Initiating cross-chain response for: ${swap.swapId}`);
    
    try {
      switch (`${swap.fromChain}->${swap.toChain}`) {
        case 'ethereum->tron':
          await this.resolver.processEthToTronSwap({
            secretHash: swap.hashlock,
            timelock: swap.timelock,
            tronAccount: swap.targetAddress,
            ethRecipient: swap.userAddress,
            amount: swap.amount
          });
          break;
          
        case 'tron->ethereum':
          await this.resolver.processTronToEthSwap({
            secretHash: swap.hashlock,
            timelock: swap.timelock,
            ethRecipient: swap.targetAddress,
            tronAmount: swap.amount
          });
          break;
          
        case 'ethereum->near':
          await this.resolver.processEthToNearSwap({
            secretHash: swap.hashlock,
            timelock: swap.timelock,
            nearAccount: swap.targetAddress,
            ethRecipient: swap.userAddress,
            amount: swap.amount
          });
          break;
          
        case 'near->ethereum':
          await this.resolver.processNearToEthSwap({
            secretHash: swap.hashlock,
            timelock: swap.timelock,
            ethRecipient: swap.targetAddress,
            amount: swap.amount
          });
          break;
          
        default:
          throw new Error(`Unsupported swap route: ${swap.fromChain} -> ${swap.toChain}`);
      }
      
      swap.status = 'locked';
      swap.lastUpdate = Date.now();
      
    } catch (error) {
      console.error(`Failed to initiate cross-chain response:`, error);
      swap.status = 'failed';
      swap.lastUpdate = Date.now();
    }
  }

  private async completeCrossChainSwap(swap: PendingSwap): Promise<void> {
    if (!swap.secret) {
      console.error(`Cannot complete swap without secret: ${swap.swapId}`);
      return;
    }
    
    console.log(`🎯 Completing cross-chain swap: ${swap.swapId}`);
    
    // Use the revealed secret to complete the other side
    // This would call the appropriate completion method on the target chain
    
    // For now, just mark as completed
    swap.status = 'completed';
    swap.lastUpdate = Date.now();
    
    console.log(`✅ Cross-chain swap completed: ${swap.swapId}`);
    this.emit('swapCompleted', swap);
  }

  private startProcessingLoop(): void {
    this.processingInterval = setInterval(() => {
      this.processExpiredSwaps();
      this.cleanupCompletedSwaps();
    }, 30000); // Run every 30 seconds
  }

  private processExpiredSwaps(): void {
    const now = Date.now();
    
    for (const [swapId, swap] of this.pendingSwaps) {
      if (swap.status === 'created' && now > swap.timelock) {
        console.log(`⏰ Swap expired: ${swapId}`);
        swap.status = 'failed';
        swap.lastUpdate = now;
        this.emit('swapExpired', swap);
      }
    }
  }

  private cleanupCompletedSwaps(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [swapId, swap] of this.pendingSwaps) {
      if (
        (swap.status === 'completed' || swap.status === 'refunded' || swap.status === 'failed') &&
        swap.lastUpdate < cutoff
      ) {
        this.pendingSwaps.delete(swapId);
        console.log(`🧹 Cleaned up old swap: ${swapId}`);
      }
    }
  }

  // Utility methods
  private generateSwapId(chain: string, hashlock: string): string {
    return `${chain}_${hashlock.substring(0, 10)}_${Date.now()}`;
  }

  private determineTargetChain(event: CrossChainEvent): 'ethereum' | 'tron' | 'near' {
    // Logic to determine target chain based on event data
    // This would typically be encoded in the original swap request
    // For now, default routing
    if (event.chain === 'ethereum') return 'tron';
    if (event.chain === 'tron') return 'ethereum';
    return 'ethereum';
  }

  private findSwapByEscrow(escrow: string): PendingSwap | undefined {
    for (const swap of this.pendingSwaps.values()) {
      // This would match based on escrow address or other identifier
      if (swap.swapId.includes(escrow.substring(0, 10))) {
        return swap;
      }
    }
    return undefined;
  }

  // Public API
  getPendingSwaps(): PendingSwap[] {
    return Array.from(this.pendingSwaps.values());
  }

  getSwapStatus(swapId: string): PendingSwap | undefined {
    return this.pendingSwaps.get(swapId);
  }
}