export interface BridgeEvent {
  id: string;
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH' | 'ETH_TO_TRON' | 'TRON_TO_ETH';
  status: 'PENDING' | 'PROCESSING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  ethTxHash?: string;
  nearTxHash?: string;
  tronTxHash?: string;
  escrowAddress?: string;
  contractId?: string;
  orderHash?: string; // 1inch Fusion+ order hash
  hashlock: string;
  secret?: string;
  amount: string;
  ethRecipient?: string;
  nearAccount?: string;
  tronAddress?: string; // TRON address for ETH<->TRON swaps
  tronSender?: string; // TRON sender address for TRON->ETH bridges
  timelock?: number;
  createdAt: number;
  completedAt?: number;
  ethCompletionTxHash?: string;
  error?: string; // Error message for failed bridges
}

export interface EthEscrowCreatedEvent {
  escrow: string;
  hashlock: string;
  nearAccount: string;
  amount: string;
  blockNumber: number;
  txHash: string;
  from?: string; // Sender ETH address
}

export interface NearHTLCEvent {
  contractId: string;
  sender: string;
  receiver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  ethAddress: string;
  blockHeight: number;
}

export interface ResolverConfig {
  ethRpcUrl: string;
  ethBridgeContract: string;
  ethPrivateKey: string;
  ethAdminPrivateKey?: string; // Admin key for minting ETH
  nearNetworkId: string;
  nearRpcUrl: string;
  nearContractId: string;
  nearAccountId: string;
  nearPrivateKey: string;
  inchEscrowFactory: string;
  tronConfig?: {
    privateKey: string;
    fullHost: string;
    bridgeContract: string;
    chainId: string;
  };
  crossChainResolverAddress: string; // Notre contrat déployé
}

export interface SwapRequest {
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH' | 'ETH_TO_TRON' | 'TRON_TO_ETH';
  amount: string;
  hashlock: string;
  timelock: number;
  ethRecipient: string;
  nearAccount?: string; // Optional for TRON bridges
  tronAddress?: string; // For ETH_TO_TRON and TRON_TO_ETH bridges
  secret?: string;
  contractId?: string; // For NEAR_TO_ETH bridges
}