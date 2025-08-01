export interface BridgeEvent {
  id: string;
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  ethTxHash?: string;
  nearTxHash?: string;
  escrowAddress?: string;
  contractId?: string;
  hashlock: string;
  secret?: string;
  amount: string;
  ethRecipient: string;
  nearAccount: string;
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
  crossChainResolverAddress: string; // Notre contrat déployé
}

export interface SwapRequest {
  type: 'ETH_TO_NEAR' | 'NEAR_TO_ETH';
  amount: string;
  hashlock: string;
  timelock: number;
  ethRecipient: string;
  nearAccount: string;
  secret?: string;
  contractId?: string; // For NEAR_TO_ETH bridges
}