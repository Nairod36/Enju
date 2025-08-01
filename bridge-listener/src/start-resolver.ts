#!/usr/bin/env tsx

import { BridgeResolver } from './services/bridge-resolver';
import { InchFusionTypes } from './types/cross-chain-types';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../backend/.env' });

/**
 * Script de démarrage du resolver ETH ↔ TRON
 */
async function startResolver() {
  console.log('🚀 Starting ETH ↔ TRON Bridge Resolver...');
  
  // Vérifier les variables d'environnement requises
  const requiredEnvVars = [
    'ETH_RPC_URL',
    'ETH_PRIVATE_KEY', 
    'TRON_PRIVATE_KEY',
    'TRON_FULL_HOST',
    'TRON_BRIDGE_CONTRACT'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Configuration du resolver
  const config = {
    ethRpcUrl: process.env.ETH_RPC_URL!,
    ethBridgeContract: process.env.ETH_BRIDGE_CONTRACT || '0xAE2c8c3bBDC09116bE01064009f13fCc272b0944',
    ethPrivateKey: process.env.ETH_PRIVATE_KEY!,
    nearNetworkId: process.env.NEAR_NETWORK_ID || 'testnet',
    nearRpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com',
    nearContractId: process.env.NEAR_CONTRACT_ID || 'mat-event.testnet',
    nearAccountId: process.env.NEAR_ACCOUNT_ID || 'mat-event.testnet',
    nearPrivateKey: process.env.NEAR_PRIVATE_KEY || '',
    inchEscrowFactory: process.env.INCH_ESCROW_FACTORY || '0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A',
    tronConfig: {
      privateKey: process.env.TRON_PRIVATE_KEY!,
      fullHost: process.env.TRON_FULL_HOST!,
      bridgeContract: process.env.TRON_BRIDGE_CONTRACT!,
      chainId: process.env.TRON_CHAIN_ID || '2' // Shasta par défaut
    }
  };

  console.log('⚙️ Configuration:');
  console.log(`- ETH RPC: ${config.ethRpcUrl}`);
  console.log(`- TRON Host: ${config.tronConfig.fullHost}`);
  console.log(`- TRON Contract: ${config.tronConfig.bridgeContract}`);

  try {
    // Créer et démarrer le resolver
    const resolver = new BridgeResolver(config);
    
    // Gérer l'arrêt propre
    process.on('SIGINT', () => {
      console.log('\n⏹️ Shutting down resolver...');
      resolver.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n⏹️ Shutting down resolver...');
      resolver.stop();
      process.exit(0);
    });

    // Démarrer le resolver
    await resolver.start();
    
    console.log('✅ Resolver started successfully!');
    console.log('📊 Status:', resolver.getStatus());
    console.log('🔄 Watching for cross-chain swaps...');
    
    // Garder le processus vivant
    setInterval(() => {
      const status = resolver.getStatus();
      if (status.running) {
        console.log(`💚 Resolver running - Bridges: ${status.activeBridgesCount} | TRON enabled: ${status.tronEnabled}`);
      }
    }, 60000); // Status toutes les minutes

  } catch (error) {
    console.error('❌ Failed to start resolver:', error);
    process.exit(1);
  }
}

// Fonction d'aide pour tester la configuration
async function testConfiguration() {
  console.log('🧪 Testing resolver configuration...');
  
  try {
    const config = {
      ethRpcUrl: process.env.ETH_RPC_URL!,
      ethBridgeContract: process.env.ETH_BRIDGE_CONTRACT || '0xAE2c8c3bBDC09116bE01064009f13fCc272b0944',
      ethPrivateKey: process.env.ETH_PRIVATE_KEY!,
      nearNetworkId: process.env.NEAR_NETWORK_ID || 'testnet',
      nearRpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com',
      nearContractId: process.env.NEAR_CONTRACT_ID || 'mat-event.testnet',
      nearAccountId: process.env.NEAR_ACCOUNT_ID || 'mat-event.testnet',
      nearPrivateKey: process.env.NEAR_PRIVATE_KEY || '',
      inchEscrowFactory: process.env.INCH_ESCROW_FACTORY || '0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A',
      tronConfig: {
        privateKey: process.env.TRON_PRIVATE_KEY!,
        fullHost: process.env.TRON_FULL_HOST!,
        bridgeContract: process.env.TRON_BRIDGE_CONTRACT!,
        chainId: process.env.TRON_CHAIN_ID || '2'
      }
    };

    const resolver = new BridgeResolver(config);
    const status = resolver.getStatus();
    
    console.log('✅ Configuration test passed!');
    console.log('📊 Resolver Status:', status);
    
    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    return false;
  }
}

// Point d'entrée principal
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      testConfiguration();
      break;
    case 'start':
    default:
      startResolver();
      break;
  }
}

export { startResolver, testConfiguration };