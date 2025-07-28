import dotenv from 'dotenv';
import { CrossChainResolver } from './resolver';
import { Config } from './types';

// Load environment variables
dotenv.config();

// Simple configuration
const config: Config = {
  ethereum: {
    rpcUrl: process.env.ETH_RPC_URL || 'http://127.0.0.1:8545',
    privateKey: process.env.ETH_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    htlcContract: process.env.ETH_HTLC_CONTRACT || '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    chainId: parseInt(process.env.ETH_CHAIN_ID || '1')
  },
  near: {
    networkId: process.env.NEAR_NETWORK_ID || 'testnet',
    nodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
    accountId: process.env.NEAR_ACCOUNT_ID || 'dev-account.testnet',
    privateKey: process.env.NEAR_PRIVATE_KEY || '',
    htlcContract: process.env.NEAR_HTLC_CONTRACT || 'htlc.dev-account.testnet'
  }
};

async function main() {
  console.log('🌉 Starting Cross-Chain ETH ↔ NEAR Resolver...');
  console.log('================================================');
  
  try {
    const resolver = new CrossChainResolver(config);
    await resolver.initialize();
    
    console.log('✅ Cross-chain resolver initialized successfully!');
    console.log('📋 Ready for ETH ↔ NEAR swaps');
    console.log('');
    console.log('Configuration:');
    console.log(`  ETH RPC: ${config.ethereum.rpcUrl}`);
    console.log(`  ETH Chain ID: ${config.ethereum.chainId}`);
    console.log(`  NEAR Network: ${config.near.networkId}`);
    console.log(`  NEAR Account: ${config.near.accountId}`);
    console.log('');
    
    // Example usage
    if (process.argv.includes('--example')) {
      console.log('🧪 Running example swap...');
      await runExample(resolver);
    } else {
      console.log('💡 Add --example to run a test swap');
      console.log('💡 Or use the resolver programmatically');
    }
    
  } catch (error) {
    console.error('❌ Failed to start resolver:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runExample(resolver: CrossChainResolver) {
  try {
    // Example ETH → NEAR swap
    const swapRequest = {
      id: 'example-swap-' + Date.now(),
      fromChain: 'ethereum' as const,
      toChain: 'near' as const,
      fromToken: '0x0000000000000000000000000000000000000000', // ETH
      toToken: 'near',
      amount: '1000000000000000000', // 1 ETH
      userEthAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      userNearAccount: 'example.testnet',
      deadline: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
    
    console.log('Creating example swap:', swapRequest);
    
    const result = await resolver.processSwap(swapRequest);
    console.log('Swap result:', result);
    
  } catch (error) {
    console.error('Example failed:', error instanceof Error ? error.message : String(error));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the application
if (require.main === module) {
  main().catch(console.error);
}

export { config };