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
      fullHost: "https://api.shasta.trongrid.io",
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
        if (response.status === 404) {
          // Contract not found - return empty array instead of throwing
          console.log(`⚠️ TRON contract not found (404) - skipping...`);
          return [];
        }
        console.error(`❌ TronGrid API error: ${response.status} - ${errorText}`);
        throw new Error(`TronGrid API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data || !(data as any).data) {
        return [];
      }

      // Filter events by event name (in case API doesn't support event_name filter)
      const filteredEvents = (data as any).data.filter((event: any) => {
        return event.event_name === 'EscrowCreated';
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


      // Parse event data
      const tronEvent: TronEscrowEvent = {
        orderHash: event.result.orderHash,
        hashlock: event.result.hashlock,
        maker: event.result.maker,
        taker: event.result.taker,
        amount: event.result.amount,
        tronMaker: event.result.tronMaker,
        ethTaker: event.result.targetAccount || event.result.ethTaker, // Use targetAccount from new contract
        txHash: txHash,
        blockNumber: Math.floor(event.block_timestamp / 1000)
      };



      // Emit event for bridge-resolver
      this.emit('tronEscrowCreated', tronEvent);

    } catch (error) {
      console.error('❌ Error processing TRON event:', error);
    }
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