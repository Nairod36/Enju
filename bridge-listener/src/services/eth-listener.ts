import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { EthEscrowCreatedEvent, ResolverConfig } from '../types';

export class EthereumListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private lastProcessedBlock: number = 0;
  private isListening: boolean = false;
  private processedEvents = new Set<string>(); // 🔥 Cache pour éviter les doublons

  // CrossChainResolver ABI (simplified for new contract)
  private readonly BRIDGE_ABI = [
    // Legacy events that the new contract emits
    'event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)',
    'event EscrowCreatedLegacy(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)',

    // New CrossChainResolver events
    'event EscrowDeployedSrc(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount, uint256 safetyDeposit)',
    'event EscrowDeployedDst(address indexed escrow, bytes32 indexed hashlock, address indexed recipient, uint256 amount)',
    'event EscrowWithdrawn(address indexed escrow, bytes32 secret, address indexed recipient)',

    // Partial Fill events
    'event PartialFillCreated(bytes32 indexed swapId, bytes32 indexed fillId, address indexed escrow, uint256 fillAmount, uint256 remainingAmount)',
    'event SwapFullyFilled(bytes32 indexed swapId, uint256 totalFilled, uint256 fillCount)',

    // Functions
    'function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (address escrow)',
    'function getSwap(bytes32 swapId) external view returns (address srcEscrow, address dstEscrow, address user, uint256 totalAmount, uint256 filledAmount, uint256 remainingAmount, bytes32 hashlock, uint8 destinationChain, string memory destinationAccount, bool completed, uint256 createdAt, uint256 fillCount)',
    'function getSwapProgress(bytes32 swapId) external view returns (uint256 totalAmount, uint256 filledAmount, uint256 remainingAmount, uint256 fillCount, bool completed, uint256 fillPercentage)'
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

    // Focus on the events that our simplified contract actually emits
    console.log('🎯 Setting up EscrowCreated event listener (main event)...');
    console.log(`🔍 Contract address being monitored: ${this.config.ethBridgeContract}`);
    this.contract.on('EscrowCreated', (escrow, hashlock, destinationChain, destinationAccount, amount, event) => {
      console.log('🔥🔥🔥 RAW EscrowCreated event received!', {
        escrow,
        hashlock,
        destinationChain,
        destinationAccount,
        amount: amount.toString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash
      });
      this.handleNewEscrowCreated(escrow, hashlock, destinationChain, destinationAccount, amount, event);
    });

    console.log('🎯 Setting up EscrowCreatedLegacy event listener (backward compatibility)...');
    this.contract.on('EscrowCreatedLegacy', (escrow, hashlock, nearAccount, amount, event) => {
      console.log('🔥🔥🔥 RAW EscrowCreatedLegacy event received!', {
        escrow,
        hashlock,
        nearAccount,
        amount: amount.toString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash
      });
      this.handleLegacyEscrowCreated(escrow, hashlock, nearAccount, amount, event);
    });

    // Advanced events (if available in future updates)
    console.log('🎯 Setting up PartialFillCreated event listener...');
    this.contract.on('PartialFillCreated', this.handlePartialFillCreated.bind(this));

    console.log('🎯 Setting up SwapFullyFilled event listener...');
    this.contract.on('SwapFullyFilled', this.handleSwapFullyFilled.bind(this));

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

  private async handleSwapFullyFilled(
    swapId: string,
    totalFilled: bigint,
    fillCount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    console.log(`🎉 SWAP FULLY FILLED:`, {
      swapId,
      totalFilled: ethers.formatEther(totalFilled),
      fillCount: fillCount.toString(),
      txHash: event.transactionHash,
      block: event.blockNumber
    });

    this.emit('swapFullyFilled', {
      swapId,
      totalFilled: totalFilled.toString(),
      fillCount: fillCount.toString(),
      txHash: event.transactionHash,
      blockNumber: event.blockNumber
    });
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

    // Get transaction details to extract sender address  
    let senderAddress = undefined;
    if (event.transactionHash) {
      try {
        const tx = await this.provider.getTransaction(event.transactionHash);
        senderAddress = tx?.from;
      } catch (error) {
        console.log(`⚠️ Failed to get transaction details for ${event.transactionHash}:`, error);
      }
    } else {
      console.log(`⚠️ No transaction hash available for event ${eventId}`);
    }

    console.log(`✅ Processing new ETH → NEAR bridge:`, {
      escrow,
      hashlock,
      nearAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      sender: senderAddress
    });

    const bridgeEvent: EthEscrowCreatedEvent = {
      escrow,
      hashlock,
      nearAccount,
      amount: amount.toString(),
      blockNumber: event.blockNumber!,
      txHash: event.transactionHash!,
      from: senderAddress // Add sender address to event
    };

    console.log(`🚀 Emitting 'escrowCreated' event to bridge-resolver:`, bridgeEvent);
    this.emit('escrowCreated', bridgeEvent);
    console.log(`✅ Event emitted successfully to bridge-resolver`);
  }

  private async handleNewEscrowCreated(
    escrow: string,
    hashlock: string,
    destinationChain: any, // Accept BigInt or number
    destinationAccount: string,
    amount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    const eventId = `${event.transactionHash}-${event.index}`;

    // Convert BigInt to number for comparison
    const destinationChainNum = typeof destinationChain === 'bigint' ? Number(destinationChain) : destinationChain;

    console.log(`🔥 INCOMING ETH EVENT: New EscrowCreated detected!`);
    console.log(`📋 Event details:`, {
      eventId,
      escrow,
      hashlock,
      destinationChain: destinationChainNum,
      destinationAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: new Date().toISOString()
    });

    // Process NEAR (0) and TRON (1) destinations
    if (destinationChainNum !== 0 && destinationChainNum !== 1) {
      console.log(`⚠️ Skipping unsupported destination chain: ${destinationChainNum}`);
      return;
    }

    // 🔥 Éviter les doublons
    if (this.processedEvents.has(eventId)) {
      console.log(`⚠️ Event ${eventId} already processed, skipping...`);
      return;
    }
    this.processedEvents.add(eventId);

    // Get transaction details to extract sender address
    let senderAddress = undefined;
    if (event.transactionHash) {
      try {
        const tx = await this.provider.getTransaction(event.transactionHash);
        senderAddress = tx?.from;
      } catch (error) {
        console.log(`⚠️ Failed to get transaction details for ${event.transactionHash}:`, error);
      }
    } else {
      console.log(`⚠️ No transaction hash available for event ${eventId}`);
    }

    console.log(`✅ Processing new ETH → NEAR bridge:`, {
      escrow,
      hashlock,
      destinationAccount,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      sender: senderAddress
    });

    if (destinationChainNum === 0) {
      // ETH → NEAR bridge
      const bridgeEvent: EthEscrowCreatedEvent = {
        escrow,
        hashlock,
        nearAccount: destinationAccount,
        amount: amount.toString(),
        blockNumber: event.blockNumber!,
        txHash: event.transactionHash!,
        from: senderAddress // Add sender address to event
      };

      console.log(`🚀 Emitting 'escrowCreated' event to bridge-resolver:`, bridgeEvent);
      this.emit('escrowCreated', bridgeEvent);
      console.log(`✅ Event emitted successfully to bridge-resolver`);
    } else if (destinationChainNum === 1) {
      // ETH → TRON bridge
      console.log(`🔥 ETH → TRON bridge detected, emitting 'ethToTronBridge' event:`, {
        escrow,
        hashlock,
        tronAddress: destinationAccount,
        amount: amount.toString(),
        blockNumber: event.blockNumber!,
        txHash: event.transactionHash!
      });

      this.emit('ethToTronBridge', {
        escrow,
        hashlock,
        tronAddress: destinationAccount,
        amount: amount.toString(),
        blockNumber: event.blockNumber!,
        txHash: event.transactionHash!
      });
      console.log(`✅ ETH → TRON event emitted successfully to bridge-resolver`);
    }
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

        // Process all events, but avoid duplicates from both legacy and new events
        const allEvents = [...legacyEvents, ...newEvents];
        const processedInThisPoll = new Set<string>();

        for (const event of allEvents) {
          const eventLog = event as ethers.EventLog;
          const eventId = `${eventLog.transactionHash}-${eventLog.index}`;

          // Skip if already processed in this poll (prevents duplicate processing of same tx)
          if (processedInThisPoll.has(eventId)) {
            console.log(`⚠️ Event ${eventId} already processed in this poll, skipping...`);
            continue;
          }
          processedInThisPoll.add(eventId);

          if (eventLog.fragment && eventLog.fragment.name === 'EscrowCreatedLegacy') {
            await this.handleLegacyEscrowCreated(
              eventLog.args[0], // escrow
              eventLog.args[1], // hashlock
              eventLog.args[2], // nearAccount
              eventLog.args[3], // amount
              eventLog
            );
          } else if (eventLog.fragment && eventLog.fragment.name === 'EscrowCreated') {
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

  private async handlePartialFillCreated(
    swapId: string,
    fillId: string,
    escrow: string,
    fillAmount: bigint,
    remainingAmount: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    const eventId = `${event.transactionHash}-${event.index}`;
    console.log(`🔥 INCOMING ETH EVENT: PartialFillCreated detected!`);
    console.log(`📋 Event details:`, {
      eventId,
      swapId,
      fillId,
      escrow,
      fillAmount: ethers.formatEther(fillAmount),
      remainingAmount: ethers.formatEther(remainingAmount),
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: new Date().toISOString()
    });

    // Avoid duplicates
    if (this.processedEvents.has(eventId)) {
      console.log(`⚠️ Event ${eventId} already processed, skipping...`);
      return;
    }
    this.processedEvents.add(eventId);

    this.emit('partialFillCreated', {
      swapId,
      fillId,
      escrow,
      fillAmount: fillAmount.toString(),
      remainingAmount: remainingAmount.toString(),
      txHash: event.transactionHash,
      blockNumber: event.blockNumber
    });
    console.log(`✅ PartialFillCreated event emitted successfully`);
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