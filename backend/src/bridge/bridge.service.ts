import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { BridgeRequestDto, BridgeResponseDto, SupportedChain } from './dto/bridge-request.dto';
import { OneinchService } from '../oneinch/oneinch.service';

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);

  constructor(private readonly oneinchService: OneinchService) {}

  async processEthToTron(request: BridgeRequestDto): Promise<BridgeResponseDto> {
    this.logger.log(`Processing ETH to TRON bridge: ${request.amount} ETH -> ${request.tronAddress}`);
    
    try {
      // Validate request
      if (!request.tronAddress) {
        throw new BadRequestException('Tron address is required for ETH to TRON bridge');
      }
      
      if (!request.ethAddress) {
        throw new BadRequestException('Ethereum address is required');
      }

      // TODO: Implement actual bridge logic
      // 1. Create HTLC secret and hashlock
      // 2. Call TronClient.createTronBridge()
      // 3. Interact with InchFusionResolver
      // 4. Monitor and complete swap
      
      // Mock response for now
      const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);
      const mockSwapId = 'tron_' + Date.now().toString();
      
      this.logger.log(`ETH to TRON bridge initiated: ${mockTxHash}`);
      
      return {
        success: true,
        txHash: mockTxHash,
        swapId: mockSwapId
      };
      
    } catch (error) {
      this.logger.error('ETH to TRON bridge failed:', error);
      return {
        success: false,
        error: error.message || 'Bridge failed'
      };
    }
  }

  async processTronToEth(request: BridgeRequestDto): Promise<BridgeResponseDto> {
    this.logger.log(`Processing TRON to ETH bridge: ${request.amount} TRX -> ${request.ethAddress}`);
    
    try {
      // Validate request
      if (!request.ethAddress) {
        throw new BadRequestException('Ethereum address is required for TRON to ETH bridge');
      }
      
      if (!request.tronAddress) {
        throw new BadRequestException('Tron address is required');
      }

      // TODO: Implement actual bridge logic
      // 1. Listen for Tron bridge creation
      // 2. Create corresponding Ethereum escrow
      // 3. Monitor secret revelation
      // 4. Complete both sides
      
      // Mock response for now
      const mockTxHash = 'TR' + Math.random().toString(16).substring(2, 32).toUpperCase();
      const mockSwapId = 'eth_' + Date.now().toString();
      
      this.logger.log(`TRON to ETH bridge initiated: ${mockTxHash}`);
      
      return {
        success: true,
        txHash: mockTxHash,
        swapId: mockSwapId
      };
      
    } catch (error) {
      this.logger.error('TRON to ETH bridge failed:', error);
      return {
        success: false,
        error: error.message || 'Bridge failed'
      };
    }
  }

  async processNearToEth(request: BridgeRequestDto): Promise<BridgeResponseDto> {
    this.logger.log(`Processing NEAR to ETH bridge: ${request.amount} NEAR -> ${request.ethAddress}`);
    
    try {
      // This would use existing NEAR bridge logic
      // TODO: Integrate with existing NEAR bridge implementation
      
      const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);
      
      return {
        success: true,
        txHash: mockTxHash
      };
      
    } catch (error) {
      this.logger.error('NEAR to ETH bridge failed:', error);
      return {
        success: false,
        error: error.message || 'Bridge failed'
      };
    }
  }

  private validateBridgeRoute(fromChain: SupportedChain, toChain: SupportedChain): void {
    // Only allow supported routes
    const validRoutes = [
      'ethereum->near',
      'near->ethereum', 
      'ethereum->tron',
      'tron->ethereum'
    ];
    
    const route = `${fromChain}->${toChain}`;
    
    if (!validRoutes.includes(route)) {
      throw new BadRequestException(
        `Bridge route ${route} not supported. Valid routes: ${validRoutes.join(', ')}`
      );
    }
  }

  async processBridge(request: BridgeRequestDto): Promise<BridgeResponseDto> {
    // Validate route
    this.validateBridgeRoute(request.fromChain, request.toChain);
    
    // Route to appropriate handler
    if (request.fromChain === SupportedChain.ETHEREUM && request.toChain === SupportedChain.TRON) {
      return this.processEthToTron(request);
    }
    
    if (request.fromChain === SupportedChain.TRON && request.toChain === SupportedChain.ETHEREUM) {
      return this.processTronToEth(request);
    }
    
    if (request.fromChain === SupportedChain.NEAR && request.toChain === SupportedChain.ETHEREUM) {
      return this.processNearToEth(request);
    }
    
    throw new BadRequestException(`Bridge route not implemented: ${request.fromChain} -> ${request.toChain}`);
  }

  /**
   * Get bridge quote with 1inch price data
   */
  async getBridgeQuote(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    amount: string,
    userAddress?: string
  ): Promise<{
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromAmount: string;
    estimatedToAmount: string;
    exchangeRate: number;
    bridgeFee: string;
    estimatedGas: string;
    userBalances?: any;
    supportedTokens?: any;
  }> {
    this.logger.log(`Getting bridge quote: ${fromChain} -> ${toChain}, amount: ${amount}`);

    // Validate route
    this.validateBridgeRoute(fromChain, toChain);

    try {
      // Get token addresses for pricing
      const fromTokenAddress = this.getTokenAddressForChain(fromChain);
      const toTokenAddress = this.getTokenAddressForChain(toChain);

      // Get spot price using 1inch
      const priceData = await this.oneinchService.getSpotPrice(
        fromTokenAddress,
        '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5', // USDC as reference
        amount,
        1 // Ethereum mainnet for pricing
      );

      // Calculate bridge fee (0.3%)
      const bridgeFeeRate = 0.003;
      const bridgeFee = (parseFloat(amount) * bridgeFeeRate).toString();
      const netAmount = (parseFloat(amount) - parseFloat(bridgeFee)).toString();

      // Estimate destination amount (simplified)
      const estimatedToAmount = (parseFloat(netAmount) * priceData.rate).toString();

      // Get user balances if address provided
      let userBalances;
      if (userAddress) {
        try {
          userBalances = await this.oneinchService.getMultiChainBalances(userAddress);
        } catch (error) {
          this.logger.warn(`Failed to fetch user balances: ${error.message}`);
        }
      }

      return {
        fromChain,
        toChain,
        fromAmount: amount,
        estimatedToAmount,
        exchangeRate: priceData.rate,
        bridgeFee,
        estimatedGas: '21000', // Simplified
        userBalances,
      };

    } catch (error) {
      this.logger.error(`Failed to get bridge quote: ${error.message}`);
      throw new BadRequestException(`Failed to get bridge quote: ${error.message}`);
    }
  }

  /**
   * Get comprehensive bridge analytics
   */
  async getBridgeAnalytics(): Promise<{
    totalVolume24h: string;
    totalTransactions24h: number;
    supportedChains: SupportedChain[];
    topTokens: any[];
    averageBridgeTime: string;
    successRate: number;
  }> {
    this.logger.log('Fetching comprehensive bridge analytics');

    try {
      // Get supported tokens from 1inch
      const ethereumTokens = await this.oneinchService.getSupportedTokens(1);
      const polygonTokens = await this.oneinchService.getSupportedTokens(137);

      // Mock analytics data (in production, fetch from database)
      return {
        totalVolume24h: '1250000.50', // USD
        totalTransactions24h: 847,
        supportedChains: [SupportedChain.ETHEREUM, SupportedChain.NEAR, SupportedChain.TRON],
        topTokens: ethereumTokens.slice(0, 10), // Top 10 tokens from 1inch
        averageBridgeTime: '4.2', // minutes
        successRate: 98.7, // percentage
      };

    } catch (error) {
      this.logger.error(`Failed to get bridge analytics: ${error.message}`);
      throw new BadRequestException(`Failed to get bridge analytics: ${error.message}`);
    }
  }

  /**
   * Get user's bridge history with enhanced data
   */
  async getUserBridgeHistory(
    userAddress: string,
    limit: number = 10
  ): Promise<{
    address: string;
    totalBridges: number;
    totalVolume: string;
    chains: any[];
    recentBridges: any[];
    portfolio: any;
  }> {
    this.logger.log(`Fetching bridge history for user: ${userAddress}`);

    try {
      // Get user's portfolio from 1inch
      const portfolio = await this.oneinchService.getMultiChainBalances(userAddress);

      // Mock bridge history (in production, fetch from database)
      const recentBridges = [
        {
          id: 'bridge_1',
          timestamp: new Date().toISOString(),
          fromChain: SupportedChain.ETHEREUM,
          toChain: SupportedChain.NEAR,
          fromAmount: '0.5',
          toAmount: '0.49',
          status: 'completed',
          txHashes: {
            source: '0xabc...',
            destination: 'def123...'
          }
        }
      ];

      return {
        address: userAddress,
        totalBridges: recentBridges.length,
        totalVolume: portfolio.reduce((sum, chain) => sum + chain.totalValueUsd, 0).toString(),
        chains: portfolio.map(p => ({ chainId: p.chainId, balance: p.totalValueUsd })),
        recentBridges,
        portfolio,
      };

    } catch (error) {
      this.logger.error(`Failed to get user bridge history: ${error.message}`);
      throw new BadRequestException(`Failed to get user bridge history: ${error.message}`);
    }
  }

  /**
   * Validate user has sufficient balance for bridge
   */
  async validateBridgeBalance(
    userAddress: string,
    fromChain: SupportedChain,
    amount: string
  ): Promise<{
    hasBalance: boolean;
    userBalance: string;
    requiredAmount: string;
    tokenInfo?: any;
  }> {
    this.logger.log(`Validating balance for ${userAddress} on ${fromChain}`);

    try {
      const chainId = this.getChainIdFromEnum(fromChain);
      const balances = await this.oneinchService.getWalletBalances(userAddress, chainId);

      // Check native token balance
      const userBalance = balances.nativeToken.balance;
      const hasBalance = parseFloat(balances.nativeToken.balanceFormatted) >= parseFloat(amount);

      return {
        hasBalance,
        userBalance: balances.nativeToken.balanceFormatted,
        requiredAmount: amount,
        tokenInfo: balances.nativeToken,
      };

    } catch (error) {
      this.logger.error(`Failed to validate balance: ${error.message}`);
      return {
        hasBalance: false,
        userBalance: '0',
        requiredAmount: amount,
      };
    }
  }

  /**
   * Helper methods
   */
  private getTokenAddressForChain(chain: SupportedChain): string {
    switch (chain) {
      case SupportedChain.ETHEREUM:
        return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // ETH
      case SupportedChain.NEAR:
        return '0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4'; // NEAR on Ethereum
      case SupportedChain.TRON:
        return '0x50327c6c5a14DCaDE707ABad2E27eB517df87AB5'; // TRX on Ethereum
      default:
        return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
  }

  private getChainIdFromEnum(chain: SupportedChain): number {
    switch (chain) {
      case SupportedChain.ETHEREUM:
        return 1;
      case SupportedChain.NEAR:
        return 1; // NEAR tokens are on Ethereum for pricing
      case SupportedChain.TRON:
        return 1; // TRON tokens are on Ethereum for pricing
      default:
        return 1;
    }
  }
}