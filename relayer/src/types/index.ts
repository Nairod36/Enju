export interface SwapEvent {
  id: string;
  fromChain: 'ethereum' | 'near';
  toChain: 'ethereum' | 'near';
  fromToken: string;
  toToken: string;
  amount: string;
  userAddress: string;
  secretHash: string;
  timelock: number;
  status: 'pending' | 'locked' | 'released' | 'refunded' | 'failed';
  txHash?: string;
  blockNumber?: number;
  timestamp: number;
}

export interface HTLCLock {
  secretHash: string;
  recipient: string;
  amount: string;
  timelock: number;
  token: string;
}

export interface RelayerConfig {
  ethereum: {
    rpcUrl: string;
    privateKey: string;
  };
  near: {
    networkId: string;
    contractId: string;
    accountId: string;
  };
  fusion: {
    authKey: string;
    apiUrl: string;
  };
  monitoring: {
    logLevel: string;
    pollInterval: number;
  };
}