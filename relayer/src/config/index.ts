import dotenv from 'dotenv';
import { RelayerConfig } from '../types';

dotenv.config();

export const config: RelayerConfig = {
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    privateKey: process.env.PRIVATE_KEY || '',
  },
  near: {
    networkId: process.env.NEAR_NETWORK_ID || 'testnet',
    contractId: process.env.NEAR_CONTRACT_ID || 'fusion-htlc.testnet',
    accountId: process.env.NEAR_ACCOUNT_ID || '',
  },
  fusion: {
    authKey: process.env.FUSION_AUTH_KEY || '',
    apiUrl: process.env.FUSION_API_URL || 'https://api.1inch.dev/fusion-plus',
  },
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    pollInterval: parseInt(process.env.POLL_INTERVAL || '5000'),
  },
};

// Validation
if (!config.ethereum.privateKey) {
  throw new Error('PRIVATE_KEY is required');
}

if (!config.near.accountId) {
  throw new Error('NEAR_ACCOUNT_ID is required');
}

if (!config.fusion.authKey) {
  throw new Error('FUSION_AUTH_KEY is required');
}