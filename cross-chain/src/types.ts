// 1inch Fusion+ Cross-Chain Types (Simplified)

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

// 1inch Fusion+ specific types
export namespace InchFusionTypes {
  export interface Config {
    ethereum: {
      rpcUrl: string;
      chainId: number;
      privateKey: string;
      crossChainResolverAddress: string;
    };
    near: {
      networkId: string;
      nodeUrl: string;
      accountId: string;
      privateKey: string;
      contractId: string;
    };
  }

  export interface EthToNearSwap {
    secretHash: string;
    timelock: number;
    nearAccount: string;
    ethRecipient: string;
    amount: string;
  }

  export interface NearToEthSwap {
    secretHash: string;
    timelock: number;
    ethRecipient: string;
    amount: string;
  }

  export interface SwapResult {
    success: boolean;
    escrowSrcAddress?: string;
    nearContractId?: string;
    secret?: string;
    error?: string;
  }

  export interface ResolverStatus {
    initialized: boolean;
    ethAddress: string;
    nearAccount: string;
    escrowFactory: string;
    crossChainResolver: string;
  }
}