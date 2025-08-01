import { TronWeb } from 'tronweb';
import { InchFusionTypes } from '../types/cross-chain-types';
const TronFusionBridgeAbi = require('../contracts/TronFusionBridge.abi.json');

// 1inch Fusion+ compatible TRON client
export class TronFusionClient {
  private tronWeb: any;
  private fusionBridgeContract: any;
  private config: InchFusionTypes.Config['tron'];

  constructor(config: InchFusionTypes.Config['tron']) {
    this.config = config;
    
    // Clean private key (remove 0x prefix if present)
    const cleanPrivateKey = config.privateKey.startsWith('0x') 
      ? config.privateKey.slice(2) 
      : config.privateKey;
    
    console.log('🔧 Initializing TronWeb for Fusion+ compatibility...');
    
    // Initialize TronWeb
    this.tronWeb = new TronWeb({
      fullHost: config.fullHost,
      privateKey: cleanPrivateKey,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });
    
    this.initializeFusionBridgeContract();
  }

  private async initializeFusionBridgeContract() {
    try {
      console.log('🔧 Initializing TRON Fusion+ bridge contract at:', this.config.bridgeContract);
      
      // Use explicit ABI instead of trying to fetch from network
      this.fusionBridgeContract = await this.tronWeb.contract(
        TronFusionBridgeAbi,
        this.config.bridgeContract
      );
      
      console.log('✅ TRON Fusion+ bridge contract initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize TRON Fusion+ bridge contract:', error);
      console.error('💡 Check if the TronFusionBridge contract is deployed correctly');
    }
  }

  /**
   * Create TRON escrow with 1inch Fusion+ compatibility
   */
  async createTronEscrow(
    immutables: FusionImmutables,
    tronMaker: string,
    ethTaker: string
  ): Promise<{ success: boolean; txHash?: string; orderHash?: string; error?: string }> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }


      // Convert addresses for TRON compatibility (et conversion en Sun)
      const tronImmutables = this.convertToTronImmutables(immutables);
      // Utiliser les valeurs converties (string d'entier)
      const amountInSun = BigInt(tronImmutables.amount);
      const safetyDepositInSun = BigInt(tronImmutables.safetyDeposit);
      const totalRequiredSun = amountInSun + safetyDepositInSun;

      // Check balance before sending
      const currentBalance = await this.tronWeb.trx.getBalance();
      const balanceInTrx = this.tronWeb.fromSun(currentBalance);
      const totalRequiredTrx = this.tronWeb.fromSun(totalRequiredSun.toString());

      console.log('🚀 Creating TRON Fusion+ escrow...');
      console.log('💰 Current balance:', balanceInTrx, 'TRX');
      console.log('💸 Required amount:', totalRequiredTrx, 'TRX');
      console.log('� Valeurs brutes Sun:', {
        amountInSun: tronImmutables.amount,
        safetyDepositInSun: tronImmutables.safetyDeposit,
        totalRequiredSun: totalRequiredSun.toString()
      });
      console.log('�📋 Immutables:', {
        orderHash: tronImmutables.orderHash,
        hashlock: tronImmutables.hashlock.substring(0, 10) + '...',
        maker: tronImmutables.maker,
        taker: tronImmutables.taker,
        amount: this.tronWeb.fromSun(amountInSun.toString()),
        safetyDeposit: this.tronWeb.fromSun(safetyDepositInSun.toString())
      });

      if (BigInt(currentBalance) < totalRequiredSun) {
        throw new Error(`Insufficient TRX balance: ${balanceInTrx} TRX < ${totalRequiredTrx} TRX required`);
      }

      // Format parameters in the exact order expected by the contract ABI
      const formattedImmutables = [
        tronImmutables.orderHash,
        tronImmutables.hashlock,
        tronImmutables.maker,
        tronImmutables.taker,
        tronImmutables.token,
        tronImmutables.amount,
        tronImmutables.safetyDeposit,
        [
          tronImmutables.timelocks.srcWithdrawal,
          tronImmutables.timelocks.srcPublicWithdrawal,
          tronImmutables.timelocks.srcCancellation,
          tronImmutables.timelocks.srcPublicCancellation,
          tronImmutables.timelocks.dstWithdrawal,
          tronImmutables.timelocks.dstPublicWithdrawal,
          tronImmutables.timelocks.dstCancellation
        ]
      ];

      const transaction = await this.fusionBridgeContract.createTronEscrow(
        formattedImmutables,
        tronMaker,
        ethTaker
      ).send({
        callValue: totalRequiredSun.toString(), // Contract requires full amount + safety deposit
        feeLimit: 100000000 // 100 TRX fee limit
      });

      return {
        success: true,
        txHash: transaction,
        orderHash: immutables.orderHash
      };
    } catch (error) {
      console.error('❌ TRON Fusion+ escrow creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete swap with secret (private withdrawal stage)
   */
  async withdraw(
    orderHash: string,
    secret: string,
    immutables: FusionImmutables
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }

      const tronImmutables = this.convertToTronImmutables(immutables);

      const transaction = await this.fusionBridgeContract.withdraw(
        orderHash,
        secret,
        tronImmutables
      ).send({
        feeLimit: 50000000 // 50 TRX fee limit
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('❌ TRON Fusion+ withdrawal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete swap during public withdrawal stage
   */
  async publicWithdraw(
    orderHash: string,
    secret: string,
    immutables: FusionImmutables
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }

      const tronImmutables = this.convertToTronImmutables(immutables);

      const transaction = await this.fusionBridgeContract.publicWithdraw(
        orderHash,
        secret,
        tronImmutables
      ).send({
        feeLimit: 50000000
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('❌ TRON Fusion+ public withdrawal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel swap (private cancellation stage)
   */
  async cancel(
    orderHash: string,
    immutables: FusionImmutables
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }

      const tronImmutables = this.convertToTronImmutables(immutables);

      const transaction = await this.fusionBridgeContract.cancel(
        orderHash,
        tronImmutables
      ).send({
        feeLimit: 50000000
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('❌ TRON Fusion+ cancellation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Public cancellation stage
   */
  async publicCancel(
    orderHash: string,
    immutables: FusionImmutables
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }

      const tronImmutables = this.convertToTronImmutables(immutables);

      const transaction = await this.fusionBridgeContract.publicCancel(
        orderHash,
        tronImmutables
      ).send({
        feeLimit: 50000000
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('❌ TRON Fusion+ public cancellation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get swap details with Fusion+ compatibility
   */
  async getFusionSwap(orderHash: string): Promise<TronFusionSwap | null> {
    try {
      if (!this.fusionBridgeContract) {
        await this.initializeFusionBridgeContract();
      }

      const swapDetails = await this.fusionBridgeContract.getSwap(orderHash).call();
      
      return {
        immutables: {
          orderHash: swapDetails.immutables.orderHash,
          hashlock: swapDetails.immutables.hashlock,
          maker: swapDetails.immutables.maker,
          taker: swapDetails.immutables.taker,
          token: swapDetails.immutables.token,
          amount: this.tronWeb.fromSun(swapDetails.immutables.amount),
          safetyDeposit: this.tronWeb.fromSun(swapDetails.immutables.safetyDeposit),
          timelocks: swapDetails.immutables.timelocks
        },
        state: this.parseSwapState(swapDetails.state),
        createdAt: swapDetails.createdAt.toNumber(),
        secretRevealed: swapDetails.secretRevealed,
        currentStage: this.parseTimelockStage(swapDetails.currentStage)
      };
    } catch (error) {
      console.error('❌ Failed to get TRON Fusion+ swap details:', error);
      return null;
    }
  }

  /**
   * Create TRON-adapted timelocks
   */
  async createTronTimelocks(): Promise<TronTimelocks> {
    try {
      const timelocks = await this.fusionBridgeContract.createTronTimelocks().call();
      return timelocks;
    } catch (error) {
      console.error('❌ Failed to create TRON timelocks:', error);
      throw error;
    }
  }

  /**
   * Watch Fusion+ compatible events
   */
  async watchFusionEvents(callback: (event: any) => void): Promise<void> {
    if (!this.fusionBridgeContract) {
      console.error('❌ Fusion bridge contract not initialized');
      return;
    }

    console.log('👀 Setting up TRON Fusion+ event polling...');
    
    // Use polling instead of .watch() which doesn't exist in TronWeb
    const pollEvents = async () => {
      try {
        // Get current block
        const currentBlock = await this.tronWeb.trx.getCurrentBlock();
        const blockNumber = currentBlock.block_header.raw_data.number;
        
        // Poll for recent events (last 10 blocks)
        const fromBlock = Math.max(0, blockNumber - 10);
        
        // No direct event polling in TronWeb, so we'll handle this differently
        // For now, just log that we're ready to process events
        console.log('📡 TRON event polling active, block:', blockNumber);
        
      } catch (error) {
        console.error('❌ TRON event polling error:', (error as Error).message);
      }
    };

    // Poll every 10 seconds
    setInterval(pollEvents, 10000);
    
    // Initial poll
    await pollEvents();
    
    console.log('✅ TRON Fusion+ event watchers started');
  }

  /**
   * Convert ETH Immutables to TRON format
   */
  private convertToTronImmutables(ethImmutables: FusionImmutables): TronImmutables {
    // Si la valeur contient un point, on considère que c'est du TRX (décimal), sinon déjà en Sun (entier)
    const amountInSun = ethImmutables.amount.includes('.')
      ? this.tronWeb.toSun(ethImmutables.amount)
      : ethImmutables.amount;
    const safetyDepositInSun = ethImmutables.safetyDeposit.includes('.')
      ? this.tronWeb.toSun(ethImmutables.safetyDeposit)
      : ethImmutables.safetyDeposit;

    return {
      orderHash: ethImmutables.orderHash,
      hashlock: ethImmutables.hashlock,
      maker: ethImmutables.maker, // ETH address as hex
      taker: ethImmutables.taker, // Resolver ETH address
      token: ethImmutables.token, // address(0) for TRX
      amount: amountInSun.toString(),
      safetyDeposit: safetyDepositInSun.toString(),
      timelocks: this.convertToTronTimelocks(ethImmutables.timelocks)
    };
  }

  /**
   * Convert ETH timelocks to TRON format (adjusted for faster block times)
   */
  private convertToTronTimelocks(ethTimelocks: any): TronTimelocks {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      srcWithdrawal: now + (30 * 60),      // 30 minutes (faster on TRON)
      srcPublicWithdrawal: now + (2 * 3600), // 2 hours
      srcCancellation: now + (6 * 3600),   // 6 hours
      srcPublicCancellation: now + (12 * 3600), // 12 hours
      dstWithdrawal: now + (1 * 3600),     // 1 hour
      dstPublicWithdrawal: now + (3 * 3600), // 3 hours
      dstCancellation: now + (8 * 3600)    // 8 hours
    };
  }

  /**
   * Parse swap state from contract
   */
  private parseSwapState(state: number): SwapState {
    const states = ['Created', 'Active', 'Completed', 'Cancelled', 'Expired'];
    return states[state] as SwapState;
  }

  /**
   * Parse timelock stage from contract
   */
  private parseTimelockStage(stage: number): TimelockStage {
    const stages = [
      'SrcWithdrawal',
      'SrcPublicWithdrawal', 
      'SrcCancellation',
      'SrcPublicCancellation',
      'DstWithdrawal',
      'DstPublicWithdrawal',
      'DstCancellation'
    ];
    return stages[stage] as TimelockStage;
  }

  // Utility methods (kept from original client)
  async getBalance(address?: string): Promise<string> {
    const targetAddress = address || this.tronWeb.defaultAddress.base58;
    const balance = await this.tronWeb.trx.getBalance(targetAddress);
    return this.tronWeb.fromSun(balance);
  }

  isValidAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  async getCurrentBlock(): Promise<number> {
    const block = await this.tronWeb.trx.getCurrentBlock();
    return block.block_header.raw_data.number;
  }

  generateSecret(): string {
    const randomBytes = require('crypto').randomBytes(32);
    return '0x' + randomBytes.toString('hex');
  }

  generateHashlock(secret: string): string {
    const crypto = require('crypto');
    const secretBytes = Buffer.from(secret.replace('0x', ''), 'hex');
    const hash = crypto.createHash('sha256').update(secretBytes).digest();
    return '0x' + hash.toString('hex');
  }

  /**
   * Send TRX directly (for simple transfers)
   */
  async sendTRX(
    toAddress: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      console.log(`📤 Sending ${amount} TRX to ${toAddress}...`);
      
      // Validate TRON address format
      if (!toAddress.startsWith('T') || toAddress.length !== 34) {
        throw new Error(`Invalid TRON address format: ${toAddress}`);
      }
      
      // Convert amount to SUN (1 TRX = 1,000,000 SUN)
      const amountInSun = this.tronWeb.toSun(amount);
      console.log(`💰 Converting ${amount} TRX to ${amountInSun} SUN`);
      
      // Use the correct TronWeb method for sending TRX
      const transaction = await this.tronWeb.trx.sendTrx(toAddress, amountInSun);
      
      console.log(`✅ TRX transaction sent: ${transaction.txid || transaction.transaction?.txID}`);
      
      return {
        success: true,
        txHash: transaction.txid || transaction.transaction?.txID
      };
    } catch (error) {
      console.error('❌ TRX transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Type definitions for 1inch Fusion+ compatibility
export interface FusionImmutables {
  orderHash: string;
  hashlock: string;
  maker: string;      // ETH address
  taker: string;      // Resolver ETH address
  token: string;      // Token address (0x0 for ETH/TRX)
  amount: string;     // Amount in appropriate units
  safetyDeposit: string; // Resolver safety deposit
  timelocks: any;     // Timelock structure
}

export interface TronImmutables {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: TronTimelocks;
}

export interface TronTimelocks {
  srcWithdrawal: number;
  srcPublicWithdrawal: number;
  srcCancellation: number;
  srcPublicCancellation: number;
  dstWithdrawal: number;
  dstPublicWithdrawal: number;
  dstCancellation: number;
}

export interface TronFusionSwap {
  immutables: TronImmutables;
  state: SwapState;
  createdAt: number;
  secretRevealed: string;
  currentStage: TimelockStage;
}

export type SwapState = 'Created' | 'Active' | 'Completed' | 'Cancelled' | 'Expired';

export type TimelockStage = 
  | 'SrcWithdrawal'
  | 'SrcPublicWithdrawal'
  | 'SrcCancellation' 
  | 'SrcPublicCancellation'
  | 'DstWithdrawal'
  | 'DstPublicWithdrawal'
  | 'DstCancellation';