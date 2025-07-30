#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { TronClient } from './tron-client';
import { PriceOracle } from './price-oracle';
import { InchFusionTypes } from './types';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../backend/.env' });

/**
 * Moniteur en temps réel des événements bridge
 */
class LiveBridgeMonitor {
  private ethProvider: ethers.JsonRpcProvider;
  private ethWallet: ethers.Wallet;
  private tronClient: TronClient;
  private priceOracle: PriceOracle;
  private ethBridgeContract: ethers.Contract;
  private isRunning = false;

  constructor() {
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL!);
    this.ethWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, this.ethProvider);
    
    const tronConfig: InchFusionTypes.Config['tron'] = {
      privateKey: process.env.TRON_PRIVATE_KEY!,
      fullHost: process.env.TRON_FULL_HOST!,
      bridgeContract: process.env.TRON_BRIDGE_CONTRACT!,
      chainId: process.env.TRON_CHAIN_ID || '2'
    };
    this.tronClient = new TronClient(tronConfig);
    this.priceOracle = new PriceOracle();
    
    this.ethBridgeContract = new ethers.Contract(
      process.env.ETH_BRIDGE_CONTRACT!,
      [
        'function createSwap(bytes32 hashlock, string calldata targetAccount) external payable returns (bytes32)',
        'function completeSwap(bytes32 swapId, bytes32 secret) external',
        'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)',
        'event SwapCreated(bytes32 indexed swapId, address indexed user, uint256 amount, bytes32 hashlock, string targetChain)',
        'event SwapCompleted(bytes32 indexed swapId, bytes32 secret)',
        'event SwapRefunded(bytes32 indexed swapId)'
      ],
      this.ethWallet
    );
  }

  /**
   * Démarrer le monitoring en temps réel
   */
  async startMonitoring(): Promise<void> {
    console.log('🔍 LIVE BRIDGE MONITOR - ETH ↔ TRON');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📡 ETH Contract: ${process.env.ETH_BRIDGE_CONTRACT}`);
    console.log(`📡 TRON Contract: ${process.env.TRON_BRIDGE_CONTRACT}`);
    console.log(`💰 ETH Address: ${this.ethWallet.address}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('🚀 Monitoring started... Press Ctrl+C to stop\n');

    this.isRunning = true;

    // Démarrer les listeners
    await Promise.all([
      this.monitorEthEvents(),
      this.monitorTronEvents(),
      this.monitorBalances()
    ]);
  }

  /**
   * Monitorer les événements ETH
   */
  private async monitorEthEvents(): Promise<void> {
    console.log('👀 Monitoring ETH events...');

    // Écouter les nouveaux swaps créés
    this.ethBridgeContract.on('SwapCreated', async (swapId, user, amount, hashlock, targetChain, event) => {
      if (!this.isRunning) return;

      console.log('\n🔔 ETH SWAP CREATED');
      console.log('═════════════════════');
      console.log(`🆔 Swap ID: ${swapId}`);
      console.log(`👤 User: ${user}`);
      console.log(`💰 Amount: ${ethers.formatEther(amount)} ETH`);
      console.log(`🔐 Hashlock: ${hashlock}`);
      console.log(`🎯 Target Chain: ${targetChain}`);
      console.log(`📋 TX Hash: ${event.transactionHash}`);
      console.log(`⛽ Block: ${event.blockNumber}`);

      // Calculer l'équivalent TRX
      try {
        const ethAmount = ethers.formatEther(amount);
        const trxAmount = await this.priceOracle.convertEthToTrx(ethAmount);
        console.log(`💱 Conversion: ${ethAmount} ETH → ${trxAmount} TRX`);
        
        // Ici le resolver créerait automatiquement le bridge TRON correspondant
        console.log('🤖 Resolver would create TRON bridge here...');
      } catch (error) {
        console.error('❌ Price conversion failed:', error);
      }

      console.log('');
    });

    // Écouter les swaps complétés
    this.ethBridgeContract.on('SwapCompleted', async (swapId, secret, event) => {
      if (!this.isRunning) return;

      console.log('\n✅ ETH SWAP COMPLETED');
      console.log('═════════════════════');
      console.log(`🆔 Swap ID: ${swapId}`);
      console.log(`🔓 Secret: ${secret}`);
      console.log(`📋 TX Hash: ${event.transactionHash}`);
      console.log(`⛽ Block: ${event.blockNumber}`);
      console.log('🤖 Resolver would complete TRON side here...');
      console.log('');
    });

    // Écouter les remboursements
    this.ethBridgeContract.on('SwapRefunded', async (swapId, event) => {
      if (!this.isRunning) return;

      console.log('\n🔄 ETH SWAP REFUNDED');
      console.log('════════════════════');
      console.log(`🆔 Swap ID: ${swapId}`);
      console.log(`📋 TX Hash: ${event.transactionHash}`);
      console.log(`⛽ Block: ${event.blockNumber}`);
      console.log('');
    });
  }

  /**
   * Monitorer les événements TRON
   */
  private async monitorTronEvents(): Promise<void> {
    console.log('👀 Monitoring TRON events...');

    this.tronClient.watchBridgeEvents((event) => {
      if (!this.isRunning) return;

      switch (event.type) {
        case 'EscrowCreated':
          console.log('\n🔔 TRON ESCROW CREATED');
          console.log('══════════════════════');
          console.log(`🆔 Escrow: ${event.data.escrow}`);
          console.log(`🔐 Hashlock: ${event.data.hashlock}`);
          console.log(`🎯 Target: ${event.data.targetAccount}`);
          console.log(`💰 Amount: ${event.data.amount} TRX`);
          console.log(`🌐 Target Chain: ${event.data.targetChain}`);
          console.log(`📋 TX Hash: ${event.data.txHash}`);
          console.log('🤖 Resolver would create ETH swap here...');
          console.log('');
          break;

        case 'SwapCompleted':
          console.log('\n✅ TRON SWAP COMPLETED');
          console.log('══════════════════════');
          console.log(`🆔 Escrow: ${event.data.escrow}`);
          console.log(`🔓 Secret: ${event.data.secret}`);
          console.log(`📋 TX Hash: ${event.data.txHash}`);
          console.log('🤖 Resolver would complete ETH side here...');
          console.log('');
          break;

        case 'SwapRefunded':
          console.log('\n🔄 TRON SWAP REFUNDED');
          console.log('═════════════════════');
          console.log(`🆔 Escrow: ${event.data.escrow}`);
          console.log(`👤 User: ${event.data.user}`);
          console.log(`📋 TX Hash: ${event.data.txHash}`);
          console.log('');
          break;
      }
    });
  }

  /**
   * Monitorer les balances périodiquement
   */
  private async monitorBalances(): Promise<void> {
    const checkBalances = async () => {
      if (!this.isRunning) return;

      try {
        const ethBalance = await this.ethProvider.getBalance(this.ethWallet.address);
        const tronBalance = await this.tronClient.getBalance();
        
        console.log(`💰 Balances: ${ethers.formatEther(ethBalance)} ETH | ${tronBalance} TRX`);
      } catch (error) {
        console.error('❌ Balance check failed:', error);
      }
    };

    // Vérifier les balances toutes les 60 secondes
    const balanceInterval = setInterval(checkBalances, 60000);
    
    // Cleanup
    const originalProcessOn = process.on;
    originalProcessOn('SIGINT', () => {
      clearInterval(balanceInterval);
      this.stop();
    });
  }

  /**
   * Créer un swap test pour déclenchement d'événements
   */
  async createTestSwap(ethAmount: string = '0.001'): Promise<void> {
    console.log('\n🧪 CREATING TEST SWAP');
    console.log('═════════════════════');
    
    try {
      // Vérifier le balance
      const ethBalance = await this.ethProvider.getBalance(this.ethWallet.address);
      console.log(`💰 Current ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
      
      if (parseFloat(ethers.formatEther(ethBalance)) < parseFloat(ethAmount)) {
        console.log('❌ Insufficient ETH balance');
        console.log('📝 Get testnet funds from: https://sepoliafaucet.com/');
        return;
      }

      // Générer HTLC
      const secret = this.tronClient.generateSecret();
      const hashlock = this.tronClient.generateHashlock(secret);
      
      console.log(`🔐 Secret: ${secret}`);
      console.log(`🔐 Hashlock: ${hashlock}`);
      console.log(`💰 Amount: ${ethAmount} ETH`);

      // Créer le swap
      console.log('📝 Creating swap transaction...');
      const tx = await this.ethBridgeContract.createSwap(
        hashlock,
        'TRON_PLACEHOLDER',
        {
          value: ethers.parseEther(ethAmount),
          gasLimit: 300000
        }
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('🔍 Monitor above will show the SwapCreated event...');
      
    } catch (error) {
      console.error('❌ Test swap failed:', error);
    }
  }

  /**
   * Arrêter le monitoring
   */
  stop(): void {
    console.log('\n⏹️ Stopping live monitor...');
    this.isRunning = false;
    this.ethBridgeContract.removeAllListeners();
    process.exit(0);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  const monitor = new LiveBridgeMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      await monitor.createTestSwap(process.argv[3] || '0.001');
      break;
    case 'monitor':
    default:
      await monitor.startMonitoring();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { LiveBridgeMonitor };