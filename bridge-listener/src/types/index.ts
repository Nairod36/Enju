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
  ethRecipient: string;
  nearAccount: string;
  tronAddress?: string; // TRON address for ETH<->TRON swaps
  timelock: number;
  createdAt: number;
  completedAt?: number;
  ethCompletionTxHash?: string;
}

export interface EthEscrowCreatedEvent {
  escrow: string;
  hashlock: string;
  nearAccount: string;
  amount: string;
  blockNumber: number;
  txHash: string;
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
  nearNetworkId: string;
  nearRpcUrl: string;
  nearContractId: string;
  nearAccountId: string;
  nearPrivateKey: string;
  inchEscrowFactory: string;
}

export interface SwapRequest {
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH' | 'ETH_TO_TRON' | 'TRON_TO_ETH';
  amount: string;
  hashlock: string;
  timelock: number;
  ethRecipient: string;
  nearAccount: string;
  secret?: string;
  contractId?: string; // For NEAR_TO_ETH bridges
}