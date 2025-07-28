/**
 * Types centralisés pour les swaps cross-chain
 */

export interface SwapData {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  secret: string;
  secretHash: string;
  timelock: number;
  status: string;
  timestamp: number;
}

export interface SwapCreatorProps {
  onSwapCreated: (swap: SwapData) => void;
}

export interface SwapListProps {
  swaps: SwapData[];
}

export type SwapDirection = 'eth-to-near' | 'near-to-eth';

export type SwapStatus = 
  | 'created' 
  | 'fusion_created' 
  | 'near_initiated'
  | 'locked' 
  | 'completed' 
  | 'expired' 
  | 'failed';

export interface SwapFormData {
  direction: SwapDirection;
  fromToken: string;
  toToken: string;
  amount: string;
  nearAddress: string;
  ethAddress: string;
  timelock: string;
}