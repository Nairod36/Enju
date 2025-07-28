export interface ResolverRequest {
  swapId: string;
  secret: string;
  claimAmount: string;
  claimer: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface ResolverCondition {
  type: 'signature' | 'timelock' | 'amount' | 'secret' | 'custom';
  description: string;
  validate: (request: ResolverRequest, swapData?: any) => Promise<boolean>;
}

export interface ResolverResult {
  success: boolean;
  txHash?: string;
  error?: string;
  validatedConditions: string[];
  failedConditions: string[];
  gasUsed?: string;
  executionTime: number;
}

export interface SwapResolutionEvent {
  swapId: string;
  resolver: string;
  claimer: string;
  amount: string;
  conditions: string[];
  txHash: string;
  timestamp: number;
}