// Simple types for cross-chain operations (no complex API stuff)

export interface SwapRequest {
  id: string;
  fromChain: 'ethereum' | 'near';
  toChain: 'ethereum' | 'near';
  fromToken: string;
  toToken: string;
  amount: string;
  userEthAddress: string;
  userNearAccount: string;
  deadline: number;
}

export interface HTLCParams {
  secret: string;
  hashlock: string;
  timelock: number;
  contractId: string;
}

export interface SwapStatus {
  id: string;
  status: 'pending' | 'locked' | 'completed' | 'failed' | 'refunded';
  ethTxHash?: string;
  nearTxHash?: string;
  htlcParams?: HTLCParams;
  error?: string;
}

export interface Config {
  ethereum: {
    rpcUrl: string;
    privateKey: string;
    htlcContract: string;
    chainId: number;
  };
  near: {
    networkId: string;
    nodeUrl: string;
    accountId: string;
    privateKey: string;
    htlcContract: string;
  };
}