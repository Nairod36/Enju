import dotenv from 'dotenv';
import { InchFusionResolver } from './inch-fusion-resolver';
import { InchFusionTypes } from './types';

// Load environment variables
dotenv.config();

// 1inch Fusion+ configuration
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
  }
};

async function main() {
  console.log('🚀 1inch Fusion+ Cross-Chain ETH ↔ NEAR Resolver');
  console.log('================================================');
  
  try {
    const resolver = new InchFusionResolver(config);
    await resolver.initialize();
    
    console.log('✅ 1inch Fusion+ resolver initialized successfully!');
    console.log('📋 Ready for ETH ↔ NEAR atomic swaps');
    console.log('');
    console.log('Configuration:');
    console.log(`  ETH RPC: ${config.ethereum.rpcUrl}`);
    console.log(`  ETH Chain ID: ${config.ethereum.chainId}`);
    console.log(`  EscrowFactory: 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a`);
    console.log(`  NEAR Network: ${config.near.networkId}`);
    console.log(`  NEAR Account: ${config.near.accountId}`);
    console.log('');
    
    const status = resolver.getStatus();
    console.log('📊 Resolver Status:', status);
    
    // Example usage
    if (process.argv.includes('--demo')) {
      console.log('🧪 Running 1inch Fusion+ demo...');
      await runDemo(resolver);
    } else {
      console.log('💡 Add --demo to run a test swap');
      console.log('💡 Uses official 1inch EscrowFactory (mainnet fork)');
    }
    
  } catch (error) {
    console.error('❌ Failed to start resolver:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runDemo(resolver: InchFusionResolver) {
  try {
    console.log('🎯 1inch Fusion+ Cross-Chain Demo');
    console.log('=================================');
    
    // Demo 1: ETH → NEAR swap
    console.log('\n📝 Demo 1: ETH → NEAR Swap');
    const ethToNearParams: InchFusionTypes.EthToNearSwap = {
      secretHash: '0x' + '1'.repeat(64), // Mock hash
      timelock: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      nearAccount: 'user.near',
      ethRecipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      amount: '1000000000000000000' // 1 ETH
    };
    
    const ethToNearResult = await resolver.processEthToNearSwap(ethToNearParams);
    console.log('ETH → NEAR Result:', ethToNearResult);
    
    // Demo 2: NEAR → ETH swap
    console.log('\n📝 Demo 2: NEAR → ETH Swap');
    const nearToEthParams: InchFusionTypes.NearToEthSwap = {
      secretHash: '0x' + '2'.repeat(64), // Mock hash
      timelock: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      ethRecipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      amount: '1000000000000000000' // 1 ETH equivalent
    };
    
    const nearToEthResult = await resolver.processNearToEthSwap(nearToEthParams);
    console.log('NEAR → ETH Result:', nearToEthResult);
    
    console.log('\n✅ Demo completed successfully!');
    console.log('💡 This demonstrates 1inch Fusion+ cross-chain architecture');
    
  } catch (error) {
    console.error('Demo failed:', error instanceof Error ? error.message : String(error));
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