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
    'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)',
    'event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)',
    'event SwapCompleted(address indexed escrow, bytes32 secret, uint8 destinationChain)',
    'function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (bytes32 swapId)',
    'function getSwap(bytes32 swapId) external view returns (address escrow, address user, uint256 amount, bytes32 hashlock, uint8 destinationChain, string memory destinationAccount, bool completed, uint256 createdAt)'
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
    console.log(`🔧 Contract address: ${this.config.ethBridgeContract}`);
    console.log(`🔧 RPC URL: ${this.config.ethRpcUrl}`);
    console.log(`🔧 Current block: ${this.lastProcessedBlock}`);
    
    // Listen for new EscrowCreated events (ETH → NEAR) - both new and legacy
    console.log('🎯 Setting up EscrowCreated event listener...');
    this.contract.on('EscrowCreated', this.handleNewEscrowCreated.bind(this));
    
    console.log('🎯 Setting up EscrowCreatedLegacy event listener...');
    this.contract.on('EscrowCreatedLegacy', this.handleLegacyEscrowCreated.bind(this));
    
    console.log('🎯 Setting up SwapCompleted event listener...');
    this.contract.on('SwapCompleted', this.handleSwapCompleted.bind(this));
    
    console.log('✅ All event listeners set up successfully');
    
    // Also poll for missed events every 10 seconds
    console.log('⏰ Starting polling for missed events every 10 seconds...');
    setInterval(() => {
      this.pollForMissedEvents();
    }, 10000);
    
    console.log('🚀 Ethereum listener is now ACTIVE and monitoring for events!');
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    this.contract.removeAllListeners();
    console.log('🛑 Ethereum listener stopped');
  }


  private async handleLegacyEscrowCreated(
    escrow: string,
    hashlock: string,
    nearAccount: string,
    amount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    const eventId = `${event.transactionHash}-${event.index}`;
    
    console.log(`🔥 INCOMING ETH EVENT: EscrowCreated detected!`);
    console.log(`📋 Event details:`, {
      eventId,
      escrow,
      hashlock,
      nearAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: new Date().toISOString()
    });
    
    // 🔥 Éviter les doublons
    if (this.processedEvents.has(eventId)) {
      console.log(`⚠️ Event ${eventId} already processed, skipping...`);
      return;
    }
    this.processedEvents.add(eventId);

    console.log(`✅ Processing new ETH → NEAR bridge:`, {
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

    console.log(`🚀 Emitting 'escrowCreated' event to bridge-resolver:`, bridgeEvent);
    this.emit('escrowCreated', bridgeEvent);
    console.log(`✅ Event emitted successfully to bridge-resolver`);
  }

  private async handleNewEscrowCreated(
    escrow: string,
    hashlock: string,
    destinationChain: number,
    destinationAccount: string,
    amount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    const eventId = `${event.transactionHash}-${event.index}`;
    
    console.log(`🔥 INCOMING ETH EVENT: New EscrowCreated detected!`);
    console.log(`📋 Event details:`, {
      eventId,
      escrow,
      hashlock,
      destinationChain,
      destinationAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: new Date().toISOString()
    });
    
    // Only process NEAR destinations (destinationChain = 0)
    if (destinationChain !== 0) {
      console.log(`⚠️ Skipping non-NEAR destination chain: ${destinationChain}`);
      return;
    }
    
    // 🔥 Éviter les doublons
    if (this.processedEvents.has(eventId)) {
      console.log(`⚠️ Event ${eventId} already processed, skipping...`);
      return;
    }
    this.processedEvents.add(eventId);

    console.log(`✅ Processing new ETH → NEAR bridge:`, {
      escrow,
      hashlock,
      nearAccount: destinationAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber
    });

    const bridgeEvent: EthEscrowCreatedEvent = {
      escrow,
      hashlock,
      nearAccount: destinationAccount,
      amount: amount.toString(),
      blockNumber: event.blockNumber!,
      txHash: event.transactionHash!
    };

    console.log(`🚀 Emitting 'escrowCreated' event to bridge-resolver:`, bridgeEvent);
    this.emit('escrowCreated', bridgeEvent);
    console.log(`✅ Event emitted successfully to bridge-resolver`);
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
        // Query for missed EscrowCreated events (both types)
        const legacyEvents = await this.contract.queryFilter(
          this.contract.filters.EscrowCreatedLegacy(),
          this.lastProcessedBlock + 1,
          currentBlock
        );

        const newEvents = await this.contract.queryFilter(
          this.contract.filters.EscrowCreated(),
          this.lastProcessedBlock + 1,
          currentBlock
        );

        // Process legacy events
        for (const event of legacyEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.fragment && eventLog.fragment.name === 'EscrowCreatedLegacy') {
            await this.handleLegacyEscrowCreated(
              eventLog.args[0], // escrow
              eventLog.args[1], // hashlock
              eventLog.args[2], // nearAccount
              eventLog.args[3], // amount
              eventLog
            );
          }
        }

        // Process new multi-chain events
        for (const event of newEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.fragment && eventLog.fragment.name === 'EscrowCreated') {
            await this.handleNewEscrowCreated(
              eventLog.args[0], // escrow
              eventLog.args[1], // hashlock
              eventLog.args[2], // destinationChain
              eventLog.args[3], // destinationAccount
              eventLog.args[4], // amount
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