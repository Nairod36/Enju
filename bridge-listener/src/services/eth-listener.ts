import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { EthEscrowCreatedEvent, ResolverConfig } from '../types';

export class EthereumListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private lastProcessedBlock: number = 0;
  private isListening: boolean = false;
  private processedEvents = new Set<string>(); // 🔥 Cache pour éviter les doublons

  // InchDirectBridge ABI (events only)
  private readonly BRIDGE_ABI = [
    'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)',
    'event NEARToETHEscrowCreated(address indexed escrow, bytes32 indexed hashlock, address indexed ethRecipient, uint256 amount)',
    'event SwapCompleted(address indexed escrow, bytes32 secret)',
    'function getSwap(bytes32 swapId) external view returns (address escrow, address user, uint256 amount, bytes32 hashlock, string memory nearAccount, bool completed, uint256 createdAt)'
  ];

  constructor(private config: ResolverConfig) {
    super();
    this.provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.contract = new ethers.Contract(
      config.ethBridgeContract,
      this.BRIDGE_ABI,
      this.provider
    );
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Ethereum listener...');
    
    // Get current block number
    this.lastProcessedBlock = await this.provider.getBlockNumber();
    console.log(`✅ Starting from block: ${this.lastProcessedBlock}`);
    
    // Verify contract exists
    const code = await this.provider.getCode(this.config.ethBridgeContract);
    if (code === '0x') {
      throw new Error(`InchDirectBridge not found at ${this.config.ethBridgeContract}`);
    }
    
    console.log('✅ Ethereum listener initialized');
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;
    
    this.isListening = true;
    console.log('👂 Starting Ethereum event listening...');
    
    // Listen for new EscrowCreated events (ETH → NEAR)
    this.contract.on('EscrowCreated', this.handleEscrowCreated.bind(this));
    
    // Listen for NEARToETHEscrowCreated events (NEAR → ETH) - ignore these as they're handled by bridge-resolver
    this.contract.on('NEARToETHEscrowCreated', this.handleNEARToETHEscrow.bind(this));
    this.contract.on('SwapCompleted', this.handleSwapCompleted.bind(this));
    
    // Also poll for missed events every 10 seconds
    setInterval(() => {
      this.pollForMissedEvents();
    }, 10000);
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    this.contract.removeAllListeners();
    console.log('🛑 Ethereum listener stopped');
  }

  private async handleNEARToETHEscrow(
    escrow: string,
    hashlock: string,
    ethRecipient: string,
    amount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    // Ignore NEAR→ETH escrows as they're created by bridge-resolver, not user
    console.log(`🔄 Ignoring NEAR→ETH escrow created by bridge-resolver: ${escrow}`);
  }

  private async handleEscrowCreated(
    escrow: string,
    hashlock: string,
    nearAccount: string,
    amount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    const eventId = `${event.transactionHash}-${event.index}`;
    
    // 🔥 Éviter les doublons
    if (this.processedEvents.has(eventId)) {
      console.log(`⚠️ Event ${eventId} already processed, skipping...`);
      return;
    }
    this.processedEvents.add(eventId);

    console.log(`📦 New ETH → NEAR bridge detected:`, {
      escrow,
      hashlock,
      nearAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber
    });

    const bridgeEvent: EthEscrowCreatedEvent = {
      escrow,
      hashlock,
      nearAccount,
      amount: amount.toString(),
      blockNumber: event.blockNumber!,
      txHash: event.transactionHash!
    };

    this.emit('escrowCreated', bridgeEvent);
  }

  private async handleSwapCompleted(
    escrow: string,
    secret: string,
    event: ethers.EventLog
  ): Promise<void> {
    console.log(`✅ ETH swap completed:`, {
      escrow,
      secret,
      txHash: event.transactionHash,
      block: event.blockNumber
    });

    this.emit('swapCompleted', {
      escrow,
      secret,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber
    });
  }

  private async pollForMissedEvents(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock > this.lastProcessedBlock) {
        // Query for missed EscrowCreated events
        const events = await this.contract.queryFilter(
          this.contract.filters.EscrowCreated(),
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of events) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.fragment && eventLog.fragment.name === 'EscrowCreated') {
            await this.handleEscrowCreated(
              eventLog.args[0], // escrow
              eventLog.args[1], // hashlock
              eventLog.args[2], // nearAccount
              eventLog.args[3], // amount
              eventLog
            );
          }
        }

        this.lastProcessedBlock = currentBlock;
      }
    } catch (error) {
      console.error('❌ Error polling for missed events:', error);
    }
  }

  async getSwapDetails(swapId: string): Promise<any> {
    try {
      return await this.contract.getSwap(swapId);
    } catch (error) {
      console.error('❌ Error getting swap details:', error);
      return null;
    }
  }

  getStatus() {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      contractAddress: this.config.ethBridgeContract,
      rpcUrl: this.config.ethRpcUrl
    };
  }
}