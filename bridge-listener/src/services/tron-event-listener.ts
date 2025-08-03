import { TronWeb } from 'tronweb';
import { EventEmitter } from 'events';

export interface TronEscrowEvent {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  amount: string;
  tronMaker: string;
  ethTaker: string;
  txHash: string;
  blockNumber: number;
}

export interface TronPartialFillEvent {
  orderHash: string;
  fillId: string;
  filler: string;
  amount: string;
  remainingAmount: string;
  targetAddress: string;
  txHash: string;
  blockNumber: number;
}

export interface TronPartialFillCompletedEvent {
  fillId: string;
  secret: string;
  filler: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}

export class TronEventListener extends EventEmitter {
  private tronWeb: any;
  private contract: any;
  private isListening = false;
  private lastProcessedBlock = 0;
  private processedTxHashes = new Set<string>();

  constructor(
    private fullHost: string,
    private contractAddress: string,
    private contractAbi: any
  ) {
    super();
    
    // Initialize TronWeb without private key (read-only)
    this.tronWeb = new TronWeb({
      fullHost: this.fullHost,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });
  }

  async initialize(): Promise<void> {
    
    try {
      // Initialize contract
      this.contract = await this.tronWeb.contract(this.contractAbi, this.contractAddress);
      
      // Get current block
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();
      this.lastProcessedBlock = currentBlock.block_header.raw_data.number;
      
    } catch (error) {
      console.error('❌ Failed to initialize TRON Event Listener:', error);
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;
    
    this.isListening = true;
    
    // Poll for events every 15 seconds (reduced frequency)
    const pollInterval = setInterval(async () => {
      if (!this.isListening) {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        await this.pollForEvents();
      } catch (error) {
        console.error('❌ Error polling TRON events:', error);
      }
    }, 15000);
    
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
  }

  private async pollForEvents(): Promise<void> {
    try {
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();
      const currentBlockNumber = currentBlock.block_header.raw_data.number;
      
      if (currentBlockNumber <= this.lastProcessedBlock) {
        // No new blocks, skip silently
        return;
      }
      
      
      // Get events from contract using TronGrid API
      const events = await this.getContractEvents(this.lastProcessedBlock + 1, currentBlockNumber);
      
      // Only process events that are actually new
      const newEvents = events.filter(event => {
        const eventBlock = Math.floor(event.block_timestamp / 1000);
        return eventBlock > this.lastProcessedBlock;
      });
      
      if (newEvents.length > 0) {
        for (const event of newEvents) {
          await this.processEvent(event);
        }
      }
      
      this.lastProcessedBlock = currentBlockNumber;
      
    } catch (error) {
      console.error('❌ Error in TRON event polling:', error);
    }
  }

  private async getContractEvents(fromBlock: number, toBlock: number): Promise<any[]> {
    try {
      // Use TronGrid API to get contract events with time filtering
      const url = `${this.fullHost}/v1/contracts/${this.contractAddress}/events`;
      
      // Calculate approximate timestamp from block numbers (TRON blocks are ~3 seconds apart)
      const now = Date.now();
      const blocksBack = Math.max(0, toBlock - fromBlock);
      // Look back 10 minutes to catch any recent events we might have missed
      const minTimestamp = now - (blocksBack * 3000) - 600000; // Add 10 minute buffer
      
      const params = new URLSearchParams({
        only_confirmed: 'true',
        order_by: 'block_timestamp,desc',
        limit: '50', // Reduced limit
        min_timestamp: minTimestamp.toString(),
        event_name: 'EscrowCreated' // Filter by event name if API supports it
      });
      
      
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'TRON-PRO-API-KEY': process.env.TRON_API_KEY || ''
        }
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ TronGrid API error: ${response.status} - ${errorText}`);
        throw new Error(`TronGrid API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data || !(data as any).data) {
        return [];
      }
      
      // Filter events by relevant event names for partial fills
      const filteredEvents = (data as any).data.filter((event: any) => {
        return ['EscrowCreated', 'PartialFillExecuted', 'PartialFillCompleted', 'PartialOrderCreated'].includes(event.event_name);
      });
      
      
      // If no events found, try a broader search without event_name filter
      if (filteredEvents.length === 0) {
        
        const broadParams = new URLSearchParams({
          only_confirmed: 'true',
          order_by: 'block_timestamp,desc',
          limit: '20',
          min_timestamp: minTimestamp.toString()
          // Remove event_name filter
        });
        
        const broadResponse = await fetch(`${url}?${broadParams}`, {
          headers: {
            'TRON-PRO-API-KEY': process.env.TRON_API_KEY || ''
          }
        });
        
        if (broadResponse.ok) {
          const broadData = await broadResponse.json();
          const events = (broadData as any)?.data || [];
        }
      }
      
      return filteredEvents;
      
    } catch (error) {
      console.error('❌ Error fetching TRON events:', error);
      return [];
    }
  }

  private async processEvent(event: any): Promise<void> {
    try {
      const txHash = event.transaction_id;
      
      // Avoid duplicates (skip silently if already processed)
      if (this.processedTxHashes.has(txHash)) {
        return;
      }
      this.processedTxHashes.add(txHash);
      
      // Handle different event types for partial fills
      switch (event.event_name) {
        case 'EscrowCreated':
          await this.processEscrowCreatedEvent(event, txHash);
          break;
        case 'PartialOrderCreated':
          await this.processPartialOrderCreatedEvent(event, txHash);
          break;
        case 'PartialFillExecuted':
          await this.processPartialFillExecutedEvent(event, txHash);
          break;
        case 'PartialFillCompleted':
          await this.processPartialFillCompletedEvent(event, txHash);
          break;
        default:
          console.log(`ℹ️ Unknown TRON event type: ${event.event_name}`);
      }
      
    } catch (error) {
      console.error('❌ Error processing TRON event:', error);
    }
  }

  private async processEscrowCreatedEvent(event: any, txHash: string): Promise<void> {
    // Parse legacy escrow event data
    const tronEvent: TronEscrowEvent = {
      orderHash: event.result.orderHash,
      hashlock: event.result.hashlock,
      maker: event.result.maker,
      taker: event.result.taker,
      amount: event.result.amount,
      tronMaker: event.result.tronMaker,
      ethTaker: event.result.targetAccount || event.result.ethTaker,
      txHash: txHash,
      blockNumber: Math.floor(event.block_timestamp / 1000)
    };
    
    console.log(`🟢 TRON EscrowCreated: ${tronEvent.orderHash}`);
    this.emit('tronEscrowCreated', tronEvent);
  }

  private async processPartialOrderCreatedEvent(event: any, txHash: string): Promise<void> {
    const partialOrderEvent = {
      orderHash: event.result.orderHash,
      maker: event.result.maker,
      totalAmount: event.result.totalAmount,
      minFillAmount: event.result.minFillAmount,
      maxFillAmount: event.result.maxFillAmount,
      targetChain: event.result.targetChain,
      txHash: txHash,
      blockNumber: Math.floor(event.block_timestamp / 1000)
    };
    
    console.log(`🟡 TRON PartialOrderCreated: ${partialOrderEvent.orderHash}`);
    this.emit('tronPartialOrderCreated', partialOrderEvent);
  }

  private async processPartialFillExecutedEvent(event: any, txHash: string): Promise<void> {
    const partialFillEvent: TronPartialFillEvent = {
      orderHash: event.result.orderHash,
      fillId: event.result.fillId,
      filler: event.result.filler,
      amount: event.result.amount,
      remainingAmount: event.result.remainingAmount,
      targetAddress: event.result.targetAddress,
      txHash: txHash,
      blockNumber: Math.floor(event.block_timestamp / 1000)
    };
    
    console.log(`🔵 TRON PartialFillExecuted: ${partialFillEvent.fillId} (${partialFillEvent.amount} TRX)`);
    this.emit('tronPartialFillExecuted', partialFillEvent);
  }

  private async processPartialFillCompletedEvent(event: any, txHash: string): Promise<void> {
    const partialFillCompletedEvent: TronPartialFillCompletedEvent = {
      fillId: event.result.fillId,
      secret: event.result.secret,
      filler: event.result.filler,
      amount: event.result.amount,
      txHash: txHash,
      blockNumber: Math.floor(event.block_timestamp / 1000)
    };
    
    console.log(`✅ TRON PartialFillCompleted: ${partialFillCompletedEvent.fillId}`);
    this.emit('tronPartialFillCompleted', partialFillCompletedEvent);
  }

  getStatus() {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      contractAddress: this.contractAddress,
      fullHost: this.fullHost
    };
  }
}