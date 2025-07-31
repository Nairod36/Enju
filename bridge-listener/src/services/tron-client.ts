import { TronWeb } from 'tronweb';
import { InchFusionTypes } from '../types/cross-chain-types';

export class TronClient {
  private tronWeb: any;
  private bridgeContract: any;
  private config: InchFusionTypes.Config['tron'];

  constructor(config: InchFusionTypes.Config['tron']) {
    this.config = config;
    
    // Nettoyer la clé privée (enlever le préfixe 0x si présent)
    const cleanPrivateKey = config.privateKey.startsWith('0x') 
      ? config.privateKey.slice(2) 
      : config.privateKey;
    
    console.log('🔧 Initializing TronWeb with clean private key...');
    
    // Initialize TronWeb
    this.tronWeb = new TronWeb({
      fullHost: config.fullHost,
      privateKey: cleanPrivateKey,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });
    
    this.initializeBridgeContract();
  }

  private async initializeBridgeContract() {
    try {
      console.log('🔧 Initializing TRON bridge contract at:', this.config.bridgeContract);
      this.bridgeContract = await this.tronWeb.contract().at(this.config.bridgeContract);
      console.log('✅ TRON bridge contract initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Tron bridge contract:', error);
      console.error('💡 Check if the contract address is correct and deployed on the network');
      // Ne pas throw l'erreur pour permettre au service de continuer
    }
  }

  /**
   * Create a Tron to ETH/NEAR bridge swap
   */
  async createTronBridge(
    hashlock: string,
    targetAccount: string,
    targetChain: 'ethereum' | 'near',
    amount: string
  ): Promise<{ success: boolean; txHash?: string; swapId?: string; error?: string }> {
    try {
      if (!this.bridgeContract) {
        await this.initializeBridgeContract();
      }

      // Convert amount to Sun (TRX smallest unit)
      const amountInSun = this.tronWeb.toSun(amount);
      
      // Call contract method
      const transaction = await this.bridgeContract.createTronBridge(
        hashlock,
        targetAccount,
        targetChain
      ).send({
        callValue: amountInSun,
        feeLimit: 100000000 // 100 TRX fee limit
      });

      // Generate swap ID using Node.js crypto (simpler approach)
      const crypto = require('crypto');
      const swapData = `${this.tronWeb.defaultAddress.base58}-${hashlock}-${targetAccount}-${targetChain}-${Date.now()}`;
      const swapId = '0x' + crypto.createHash('sha256').update(swapData).digest('hex');

      return {
        success: true,
        txHash: transaction,
        swapId: swapId
      };
    } catch (error) {
      console.error('Tron bridge creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete a Tron bridge swap
   */
  async completeSwap(
    swapId: string,
    secret: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.bridgeContract) {
        await this.initializeBridgeContract();
      }

      const transaction = await this.bridgeContract.completeSwap(
        swapId,
        secret
      ).send({
        feeLimit: 50000000 // 50 TRX fee limit
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('Tron swap completion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Refund a Tron bridge swap
   */
  async refundSwap(swapId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.bridgeContract) {
        await this.initializeBridgeContract();
      }

      const transaction = await this.bridgeContract.refundSwap(swapId).send({
        feeLimit: 50000000 // 50 TRX fee limit
      });

      return {
        success: true,
        txHash: transaction
      };
    } catch (error) {
      console.error('Tron swap refund failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get swap details
   */
  async getSwap(swapId: string): Promise<any> {
    try {
      if (!this.bridgeContract) {
        await this.initializeBridgeContract();
      }

      const swapDetails = await this.bridgeContract.getSwap(swapId).call();
      
      return {
        user: this.tronWeb.address.fromHex(swapDetails.user),
        amount: this.tronWeb.fromSun(swapDetails.amount),
        hashlock: swapDetails.hashlock,
        targetAccount: swapDetails.targetAccount,
        targetChain: swapDetails.targetChain,
        completed: swapDetails.completed,
        refunded: swapDetails.refunded,
        createdAt: swapDetails.createdAt.toNumber(),
        timelock: swapDetails.timelock.toNumber()
      };
    } catch (error) {
      console.error('Failed to get Tron swap details:', error);
      throw error;
    }
  }

  /**
   * Listen for bridge events
   */
  watchBridgeEvents(callback: (event: any) => void): void {
    if (!this.bridgeContract) {
      console.error('Bridge contract not initialized');
      return;
    }

    // Listen for EscrowCreated events
    this.bridgeContract.EscrowCreated().watch((err: any, event: any) => {
      if (err) {
        console.error('Error watching EscrowCreated events:', err);
        return;
      }
      
      callback({
        type: 'EscrowCreated',
        data: {
          escrow: event.result.escrow,
          hashlock: event.result.hashlock,
          targetAccount: event.result.targetAccount,
          amount: this.tronWeb.fromSun(event.result.amount),
          targetChain: event.result.targetChain,
          txHash: event.transaction
        }
      });
    });

    // Listen for SwapCompleted events
    this.bridgeContract.SwapCompleted().watch((err: any, event: any) => {
      if (err) {
        console.error('Error watching SwapCompleted events:', err);
        return;
      }
      
      callback({
        type: 'SwapCompleted',
        data: {
          escrow: event.result.escrow,
          secret: event.result.secret,
          txHash: event.transaction
        }
      });
    });

    // Listen for SwapRefunded events
    this.bridgeContract.SwapRefunded().watch((err: any, event: any) => {
      if (err) {
        console.error('Error watching SwapRefunded events:', err);
        return;
      }
      
      callback({
        type: 'SwapRefunded',
        data: {
          escrow: event.result.escrow,
          user: this.tronWeb.address.fromHex(event.result.user),
          txHash: event.transaction
        }
      });
    });
  }

  /**
   * Get TRX balance
   */
  async getBalance(address?: string): Promise<string> {
    const targetAddress = address || this.tronWeb.defaultAddress.base58;
    const balance = await this.tronWeb.trx.getBalance(targetAddress);
    return this.tronWeb.fromSun(balance);
  }

  /**
   * Validate Tron address
   */
  isValidAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    const block = await this.tronWeb.trx.getCurrentBlock();
    return block.block_header.raw_data.number;
  }

  /**
   * Generate random secret for HTLC
   */
  generateSecret(): string {
    // Generate 32-byte random secret
    const randomBytes = require('crypto').randomBytes(32);
    return '0x' + randomBytes.toString('hex');
  }

  /**
   * Generate hashlock from secret
   */
  generateHashlock(secret: string): string {
    const crypto = require('crypto');
    const secretBytes = Buffer.from(secret.replace('0x', ''), 'hex');
    const hash = crypto.createHash('sha256').update(secretBytes).digest();
    return '0x' + hash.toString('hex');
  }

  /**
   * Send TRX directly to an address (for ETH → TRON bridges)
   */
  async sendTRX(
    toAddress: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      console.log(`📤 Sending ${amount} TRX to ${toAddress}...`);
      
      // Convert amount to Sun (TRX smallest unit)
      const amountInSun = this.tronWeb.toSun(amount);
      
      // Send TRX transaction
      const transaction = await this.tronWeb.trx.sendTransaction(toAddress, amountInSun);
      
      console.log(`✅ TRX transaction sent: ${transaction.txid}`);
      
      return {
        success: true,
        txHash: transaction.txid
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