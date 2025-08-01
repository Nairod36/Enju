import dotenv from 'dotenv';
import { BridgeAPI } from './api/server';
import { ResolverConfig } from './types';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🌉 Bridge Listener Service Starting...');
  console.log('=====================================');

  // Validate required environment variables
  const requiredEnvVars = [
    'ETH_RPC_URL',
    'ETH_BRIDGE_CONTRACT',
    'ETH_PRIVATE_KEY',
    'NEAR_NETWORK_ID',
    'NEAR_RPC_URL',
    'NEAR_CONTRACT_ID',
    'NEAR_ACCOUNT_ID',
    'NEAR_PRIVATE_KEY',
    'INCH_ESCROW_FACTORY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('Please copy .env.example to .env and fill in the values');
    process.exit(1);
  }

  // Create configuration
  const config: ResolverConfig = {
    ethRpcUrl: process.env.ETH_RPC_URL!,
    ethBridgeContract: process.env.ETH_BRIDGE_CONTRACT!,
    ethPrivateKey: process.env.ETH_PRIVATE_KEY!,
    ethAdminPrivateKey: process.env.ETH_ADMIN_PRIVATE_KEY,
    nearNetworkId: process.env.NEAR_NETWORK_ID!,
    nearRpcUrl: process.env.NEAR_RPC_URL!,
    nearContractId: process.env.NEAR_CONTRACT_ID!,
    nearAccountId: process.env.NEAR_ACCOUNT_ID!,
    nearPrivateKey: process.env.NEAR_PRIVATE_KEY!,
    inchEscrowFactory: process.env.INCH_ESCROW_FACTORY!
  };

  const port = parseInt(process.env.PORT || '3002');

  console.log('📋 Configuration:');
  console.log(`   ETH RPC: ${config.ethRpcUrl}`);
  console.log(`   ETH Bridge: ${config.ethBridgeContract}`);
  console.log(`   ETH Private Key: ${config.ethPrivateKey.substring(0, 10)}...${config.ethPrivateKey.substring(config.ethPrivateKey.length - 4)} (${config.ethPrivateKey.length} chars)`);
  console.log(`   NEAR Network: ${config.nearNetworkId}`);
  console.log(`   NEAR RPC: ${config.nearRpcUrl}`);
  console.log(`   NEAR Contract: ${config.nearContractId}`);
  console.log(`   NEAR Account: ${config.nearAccountId}`);
  console.log(`   NEAR Private Key: ${config.nearPrivateKey.substring(0, 10)}...${config.nearPrivateKey.substring(config.nearPrivateKey.length - 4)} (${config.nearPrivateKey.length} chars)`);
  console.log(`   1inch Factory: ${config.inchEscrowFactory}`);
  console.log(`   API Port: ${port}`);
  console.log('');

  try {
    // Create and start the bridge API
    const bridgeAPI = new BridgeAPI(config, port);
    await bridgeAPI.start();

    console.log('');
    console.log('🎉 Bridge Listener Service is running!');
    console.log('=====================================');
    console.log(`📊 Health: http://localhost:${port}/health`);
    console.log(`🌉 Bridges: http://localhost:${port}/bridges`);
    console.log(`📡 Events: http://localhost:${port}/events`);
    console.log('');
    console.log('Ready to process ETH ↔ NEAR bridges! 🚀');

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await bridgeAPI.stop();
        console.log('✅ Service stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start Bridge Listener Service:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the service
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});