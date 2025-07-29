export interface EscrowEventData {
  eventType: 'SrcEscrowCreated' | 'DstEscrowCreated';
  escrowAddress: string;
  hashlock: string;
  txHash: string;
  blockNumber: number;
  orderHash?: string;
  maker?: string;
  taker?: string;
  amount?: string;
  token?: string;
  chainId: number;
  timestamp: string;
}

export interface EscrowEventResponse {
  success: boolean;
  data?: EscrowEventData[];
  error?: string;
  count?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Config {
  ethereumRpcUrl: string;
  backendApiUrl: string;
  escrowFactoryAddress: string;
  pollIntervalSeconds: number;
  blockLookback: number;
  logLevel: string;
  apiTimeoutMs: number;
  maxRetries: number;
}
