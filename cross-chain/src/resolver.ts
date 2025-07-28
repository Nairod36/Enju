import { EthereumClient } from './ethereum-client';
import { NearClient } from './near-client';
import { Utils } from './utils';
import { Config, SwapRequest, SwapStatus, HTLCParams } from './types';

export class CrossChainResolver {
  private ethClient: EthereumClient;
  private nearClient: NearClient;
  private activeSwaps: Map<string, SwapStatus> = new Map();

  constructor(private config: Config) {
    this.ethClient = new EthereumClient(config.ethereum);
    this.nearClient = new NearClient(config.near);
  }

  /**
   * Initialize both clients
   */
  async initialize(): Promise<void> {
    console.log('Initializing Ethereum client...');
    // Ethereum client is ready immediately
    
    console.log('Initializing NEAR client...');
    await this.nearClient.initialize();
    
    console.log('✅ Both clients initialized');
  }

  /**
   * Process a cross-chain swap
   */
  async processSwap(request: SwapRequest): Promise<SwapStatus> {
    console.log(`\n🔄 Processing ${request.fromChain} → ${request.toChain} swap`);
    
    const swapStatus: SwapStatus = {
      id: request.id,
      status: 'pending'
    };
    
    this.activeSwaps.set(request.id, swapStatus);

    try {
      if (request.fromChain === 'ethereum' && request.toChain === 'near') {
        return await this.processEthToNear(request, swapStatus);
      } else if (request.fromChain === 'near' && request.toChain === 'ethereum') {
        return await this.processNearToEth(request, swapStatus);
      } else {
        throw new Error(`Unsupported swap direction: ${request.fromChain} → ${request.toChain}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      swapStatus.status = 'failed';
      swapStatus.error = errorMessage;
      this.activeSwaps.set(request.id, swapStatus);
      console.error(`❌ Swap ${request.id} failed:`, errorMessage);
      return swapStatus;
    }
  }

  /**
   * Process ETH → NEAR swap
   */
  private async processEthToNear(request: SwapRequest, status: SwapStatus): Promise<SwapStatus> {
    console.log('📝 Step 1: Generate HTLC parameters');
    
    // Generate HTLC parameters
    const secret = Utils.generateSecret();
    const hashlock = Utils.generateHashlockBytes32(secret);
    const timelock = Utils.getFutureTimestamp();
    
    const htlcParams: HTLCParams = {
      secret,
      hashlock,
      timelock,
      contractId: ''
    };

    console.log('🔐 HTLC params generated:', {
      hashlock: hashlock.substring(0, 10) + '...',
      timelock: new Date(timelock).toISOString()
    });

    // Step 1: Create HTLC on Ethereum
    console.log('📝 Step 2: Create HTLC on Ethereum');
    const ethResult = await this.ethClient.createHTLCEth(
      request.userEthAddress,
      request.amount,
      hashlock,
      timelock,
      request.userNearAccount
    );

    htlcParams.contractId = ethResult.contractId;
    status.ethTxHash = ethResult.txHash;
    status.htlcParams = htlcParams;

    console.log('✅ Ethereum HTLC created:', {
      contractId: ethResult.contractId.substring(0, 10) + '...',
      txHash: ethResult.txHash.substring(0, 10) + '...'
    });

    // Step 2: Create corresponding HTLC on NEAR
    console.log('📝 Step 3: Create HTLC on NEAR');
    const hashlockBytes = Utils.hexToUint8Array(hashlock);
    
    // Convert ETH amount to NEAR equivalent (simplified)
    const nearAmount = this.convertEthToNear(request.amount);
    
    const nearResult = await this.nearClient.createHTLC(
      request.userNearAccount,
      nearAmount,
      hashlockBytes,
      timelock,
      request.userEthAddress
    );

    status.nearTxHash = nearResult.txHash;
    status.status = 'locked';

    console.log('✅ NEAR HTLC created:', {
      contractId: nearResult.contractId
    });

    console.log('🎉 Cross-chain swap setup complete!');
    console.log('💡 User can now reveal secret to claim funds on both chains');

    this.activeSwaps.set(request.id, status);
    return status;
  }

  /**
   * Process NEAR → ETH swap (simplified)
   */
  private async processNearToEth(request: SwapRequest, status: SwapStatus): Promise<SwapStatus> {
    console.log('🚧 NEAR → ETH swap (simplified implementation)');
    
    // Similar logic but reversed
    status.status = 'completed';
    status.ethTxHash = 'mock-eth-tx';
    status.nearTxHash = 'mock-near-tx';
    
    this.activeSwaps.set(request.id, status);
    return status;
  }

  /**
   * Simple ETH to NEAR conversion (mock)
   */
  private convertEthToNear(ethAmount: string): string {
    // Mock conversion: 1 ETH = 1000 NEAR (simplified)
    const ethBigInt = BigInt(ethAmount);
    const nearAmount = ethBigInt * BigInt(1000);
    return nearAmount.toString();
  }

  /**
   * Get swap status
   */
  getSwapStatus(swapId: string): SwapStatus | undefined {
    return this.activeSwaps.get(swapId);
  }

  /**
   * Get all active swaps
   */
  getAllSwaps(): SwapStatus[] {
    return Array.from(this.activeSwaps.values());
  }

  /**
   * Get client addresses/accounts
   */
  getInfo() {
    return {
      ethereum: {
        address: this.ethClient.getAddress(),
        chainId: this.config.ethereum.chainId
      },
      near: {
        accountId: this.nearClient.getAccountId(),
        network: this.config.near.networkId
      }
    };
  }
}