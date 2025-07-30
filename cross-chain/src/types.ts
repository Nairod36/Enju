// 1inch Fusion+ Cross-Chain Types (Simplified)

export interface SwapRequest {
  id: string;
  fromChain: 'ethereum' | 'near' | 'tron';
  toChain: 'ethereum' | 'near' | 'tron';
  fromToken: string;
  toToken: string;
  amount: string;
  userEthAddress: string;
  userNearAccount: string;
  userTronAddress?: string;
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
  tronTxHash?: string;
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
  tron: {
    fullHost: string;
    privateKey: string;
    bridgeContract: string;
    chainId: string;
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
    tron: {
      fullHost: string;
      privateKey: string;
      bridgeContract: string;
      chainId: string;
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