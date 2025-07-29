import { ethers, Contract } from 'ethers';
import { config, logger } from './config';
import { EscrowEventData } from './types';

export class EscrowEventListener {
  private provider: ethers.providers.JsonRpcProvider;
  private escrowFactory: Contract;
  private lastProcessedBlock: number = 0;

  // ABI for event listening - same as frontend
  private readonly ESCROW_FACTORY_ABI = [
    'event SrcEscrowCreated(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) srcImmutables, tuple(uint256 maker, uint256 amount, uint256 token, uint256 safetyDeposit, uint256 chainId) dstImmutablesComplement)',
    'event DstEscrowCreated(address escrow, bytes32 hashlock, uint256 taker)',
    'function addressOfEscrowSrc(tuple(bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256) immutables) view returns (address)'
  ];

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    try {
      this.provider = new ethers.providers.JsonRpcProvider(config.ethereumRpcUrl);
      this.escrowFactory = new Contract(
        config.escrowFactoryAddress,
        this.ESCROW_FACTORY_ABI,
        this.provider
      );

      logger.info(`Initialized escrow event listener with RPC: ${config.ethereumRpcUrl}`);
      logger.info(`Monitoring EscrowFactory at: ${config.escrowFactoryAddress}`);
    } catch (error) {
      logger.error('Failed to initialize provider:', error);
      throw error;
    }
  }

  /**
   * Fetch and process new escrow events from the blockchain
   */
  async processNewEvents(): Promise<EscrowEventData[]> {
    try {
      logger.debug('Starting to process new escrow events...');

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      
      // Initialize last processed block if needed
      if (this.lastProcessedBlock === 0) {
        this.lastProcessedBlock = Math.max(0, currentBlock - config.blockLookback);
        logger.info(`Starting from block ${this.lastProcessedBlock} (${config.blockLookback} blocks ago)`);
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = currentBlock;

      if (fromBlock > toBlock) {
        logger.debug('No new blocks to process');
        return [];
      }

      logger.info(`Processing events from block ${fromBlock} to ${toBlock}`);

      const events: EscrowEventData[] = [];

      // Fetch SrcEscrowCreated events
      const srcEvents = await this.processSrcEscrowEvents(fromBlock, toBlock);
      events.push(...srcEvents);

      // Fetch DstEscrowCreated events
      const dstEvents = await this.processDstEscrowEvents(fromBlock, toBlock);
      events.push(...dstEvents);

      // Update last processed block
      this.lastProcessedBlock = currentBlock;

      logger.info(`Successfully processed ${events.length} events up to block ${currentBlock}`);
      return events;
    } catch (error) {
      logger.error('Error processing escrow events:', error);
      throw error;
    }
  }

  private async processSrcEscrowEvents(fromBlock: number, toBlock: number): Promise<EscrowEventData[]> {
    try {
      const filter = this.escrowFactory.filters.SrcEscrowCreated();
      const events = await this.escrowFactory.queryFilter(filter, fromBlock, toBlock);

      const processedEvents: EscrowEventData[] = [];

      for (const event of events) {
        try {
          const eventData = await this.processSrcEscrowEvent(event);
          if (eventData) {
            processedEvents.push(eventData);
          }
        } catch (error) {
          logger.error(`Error processing SrcEscrowCreated event ${event.transactionHash}:`, error);
        }
      }

      logger.debug(`Processed ${processedEvents.length} SrcEscrowCreated events`);
      return processedEvents;
    } catch (error) {
      logger.error('Error processing SrcEscrowCreated events:', error);
      return [];
    }
  }

  private async processDstEscrowEvents(fromBlock: number, toBlock: number): Promise<EscrowEventData[]> {
    try {
      const filter = this.escrowFactory.filters.DstEscrowCreated();
      const events = await this.escrowFactory.queryFilter(filter, fromBlock, toBlock);

      const processedEvents: EscrowEventData[] = [];

      for (const event of events) {
        try {
          const eventData = await this.processDstEscrowEvent(event);
          if (eventData) {
            processedEvents.push(eventData);
          }
        } catch (error) {
          logger.error(`Error processing DstEscrowCreated event ${event.transactionHash}:`, error);
        }
      }

      logger.debug(`Processed ${processedEvents.length} DstEscrowCreated events`);
      return processedEvents;
    } catch (error) {
      logger.error('Error processing DstEscrowCreated events:', error);
      return [];
    }
  }

  private async processSrcEscrowEvent(event: any): Promise<EscrowEventData | null> {
    try {
      const { srcImmutables, dstImmutablesComplement } = event.args;
      
      // Get deterministic escrow address
      let escrowAddress: string;
      try {
        escrowAddress = await this.escrowFactory.addressOfEscrowSrc([
          srcImmutables.orderHash,
          srcImmutables.hashlock,
          srcImmutables.maker,
          srcImmutables.taker,
          srcImmutables.token,
          srcImmutables.amount,
          srcImmutables.safetyDeposit,
          srcImmutables.timelocks
        ]);
      } catch {
        // Fallback address if factory call fails
        escrowAddress = ethers.utils.getAddress('0x' + srcImmutables.hashlock.substring(2, 42));
      }

      // Get block timestamp
      const block = await this.provider.getBlock(event.blockNumber);

      const eventData: EscrowEventData = {
        eventType: 'SrcEscrowCreated',
        escrowAddress,
        hashlock: srcImmutables.hashlock,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        orderHash: srcImmutables.orderHash,
        maker: srcImmutables.maker.toString(),
        taker: srcImmutables.taker.toString(),
        amount: ethers.utils.formatEther(srcImmutables.amount),
        token: srcImmutables.token.toString(),
        chainId: 1, // Ethereum mainnet
        timestamp: new Date(block.timestamp * 1000).toISOString()
      };

      return eventData;
    } catch (error) {
      logger.error('Error processing SrcEscrowCreated event:', error);
      return null;
    }
  }

  private async processDstEscrowEvent(event: any): Promise<EscrowEventData | null> {
    try {
      const { escrow, hashlock, taker } = event.args;

      // Get block timestamp
      const block = await this.provider.getBlock(event.blockNumber);

      const eventData: EscrowEventData = {
        eventType: 'DstEscrowCreated',
        escrowAddress: escrow,
        hashlock,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        taker: taker.toString(),
        chainId: 1, // Ethereum mainnet
        timestamp: new Date(block.timestamp * 1000).toISOString()
      };

      return eventData;
    } catch (error) {
      logger.error('Error processing DstEscrowCreated event:', error);
      return null;
    }
  }

  /**
   * Get the current block number
   */
  async getCurrentBlock(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  /**
   * Set the last processed block manually
   */
  setLastProcessedBlock(blockNumber: number): void {
    this.lastProcessedBlock = blockNumber;
    logger.info(`Set last processed block to: ${blockNumber}`);
  }
}
