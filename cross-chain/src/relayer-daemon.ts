#!/usr/bin/env node

import dotenv from 'dotenv';
import { CrossChainRelayerService } from './relayer-service';
import { InchFusionTypes } from './types';

// Load environment variables
dotenv.config();

// Extended configuration with Tron support
const config: InchFusionTypes.Config = {
  ethereum: {
    rpcUrl: process.env.ETH_RPC_URL || 'http://127.0.0.1:8545',
    chainId: parseInt(process.env.ETH_CHAIN_ID || '31337'),
    privateKey: process.env.ETH_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    crossChainResolverAddress: process.env.CROSS_CHAIN_RESOLVER || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  },
  near: {
    networkId: process.env.NEAR_NETWORK_ID || 'testnet',
    nodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
    accountId: process.env.NEAR_ACCOUNT_ID || 'dev-account.testnet',
    privateKey: process.env.NEAR_PRIVATE_KEY || '',
    contractId: process.env.NEAR_CONTRACT_ID || 'htlc.dev-account.testnet'
  },
  tron: {
    fullHost: process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY || '',
    bridgeContract: process.env.TRON_BRIDGE_CONTRACT || '',
    chainId: process.env.TRON_CHAIN_ID || '0x2b6653dc'
  }
};

class RelayerDaemon {
  private relayerService: CrossChainRelayerService;
  private isShuttingDown = false;

  constructor() {
    this.relayerService = new CrossChainRelayerService(config);
    this.setupEventHandlers();
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    console.log('🚀 1inch Fusion+ Cross-Chain Relayer Daemon');
    console.log('==============================================');
    console.log('');
    
    this.printConfiguration();
    
    try {
      await this.relayerService.start();
      
      console.log('✅ Relayer daemon started successfully!');
      console.log('📡 Monitoring cross-chain events...');
      console.log('🔄 Processing swaps automatically...');
      console.log('');
      console.log('💡 Press Ctrl+C to stop gracefully');
      
      // Keep the process alive
      this.keepAlive();
      
    } catch (error) {
      console.error('❌ Failed to start relayer daemon:', error);
      process.exit(1);
    }
  }

  private setupEventHandlers(): void {
    // Success events
    this.relayerService.on('swapCompleted', (swap) => {
      console.log(`✅ Swap completed successfully: ${swap.swapId}`);
      console.log(`   Route: ${swap.fromChain} -> ${swap.toChain}`);
      console.log(`   Amount: ${swap.amount}`);
      console.log('');
    });

    this.relayerService.on('swapRefunded', (swap) => {
      console.log(`🔄 Swap refunded: ${swap.swapId}`);
      console.log(`   Reason: Timeout or failure`);
      console.log('');
    });

    this.relayerService.on('swapExpired', (swap) => {
      console.log(`⏰ Swap expired: ${swap.swapId}`);
      console.log(`   Route: ${swap.fromChain} -> ${swap.toChain}`);
      console.log('');
    });

    // Error events
    this.relayerService.on('error', ({ event, error }) => {
      console.error(`❌ Error processing ${event.type} event:`, error.message);
      console.error(`   Chain: ${event.chain}`);
      console.error(`   TxHash: ${event.txHash}`);
      console.error('');
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.relayerService.stop();
        console.log('✅ Relayer daemon stopped successfully');
        
        // Show final statistics
        this.printFinalStats();
        
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  private printConfiguration(): void {
    console.log('Configuration:');
    console.log(`  ETH RPC: ${config.ethereum.rpcUrl}`);
    console.log(`  ETH Chain ID: ${config.ethereum.chainId}`);
    console.log(`  NEAR Network: ${config.near.networkId}`);
    console.log(`  NEAR Account: ${config.near.accountId}`);
    console.log(`  TRON Host: ${config.tron.fullHost}`);
    console.log(`  TRON Contract: ${config.tron.bridgeContract || 'Not configured'}`);
    console.log('');
    
    // Validate critical configuration
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const errors: string[] = [];
    
    if (!config.ethereum.privateKey || config.ethereum.privateKey.length < 64) {
      errors.push('ETH_PRIVATE_KEY not configured properly');
    }
    
    if (!config.near.privateKey) {
      errors.push('NEAR_PRIVATE_KEY not configured');
    }
    
    if (!config.tron.privateKey || config.tron.privateKey.length < 64) {
      errors.push('TRON_PRIVATE_KEY not configured properly');
    }
    
    if (!config.tron.bridgeContract) {
      errors.push('TRON_BRIDGE_CONTRACT not configured');
    }
    
    if (errors.length > 0) {
      console.log('⚠️  Configuration warnings:');
      errors.forEach(error => console.log(`   - ${error}`));
      console.log('');
    }
  }

  private printFinalStats(): void {
    const pendingSwaps = this.relayerService.getPendingSwaps();
    const completed = pendingSwaps.filter(s => s.status === 'completed').length;
    const failed = pendingSwaps.filter(s => s.status === 'failed').length;
    const pending = pendingSwaps.filter(s => s.status === 'created' || s.status === 'locked').length;
    
    console.log('📊 Final Statistics:');
    console.log(`   Completed swaps: ${completed}`);
    console.log(`   Failed swaps: ${failed}`);
    console.log(`   Pending swaps: ${pending}`);
    console.log('');
    console.log('👋 Goodbye!');
  }

  private keepAlive(): void {
    // Print status every 5 minutes
    setInterval(() => {
      if (this.isShuttingDown) return;
      
      const pendingSwaps = this.relayerService.getPendingSwaps();
      const activeSwaps = pendingSwaps.filter(s => 
        s.status === 'created' || s.status === 'locked'
      ).length;
      
      console.log(`💓 Relayer heartbeat - Active swaps: ${activeSwaps}`);
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('1inch Fusion+ Cross-Chain Relayer Daemon');
    console.log('');
    console.log('Usage: npm run relayer [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --version, -v  Show version information');
    console.log('');
    console.log('Environment variables:');
    console.log('  ETH_RPC_URL              Ethereum RPC endpoint');
    console.log('  ETH_PRIVATE_KEY          Ethereum private key');
    console.log('  NEAR_ACCOUNT_ID          NEAR account ID');
    console.log('  NEAR_PRIVATE_KEY         NEAR private key');
    console.log('  TRON_PRIVATE_KEY         Tron private key');
    console.log('  TRON_BRIDGE_CONTRACT     Tron bridge contract address');
    return;
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    console.log('1inch Fusion+ Relayer v1.0.0');
    return;
  }
  
  const daemon = new RelayerDaemon();
  await daemon.start();
}

// Start the daemon
if (require.main === module) {
  main().catch(console.error);
}

export { RelayerDaemon, config };