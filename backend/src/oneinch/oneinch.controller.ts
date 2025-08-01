import {
  Controller,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { OneinchService, WalletBalances, TokenMetadata, SpotPrice } from './oneinch.service';

@ApiTags('1inch Integration')
@Controller('oneinch')
export class OneinchController {
  private readonly logger = new Logger(OneinchController.name);

  constructor(private readonly oneinchService: OneinchService) {}

  @Get('balances/:address')
  @ApiOperation({ 
    summary: 'Get wallet balances using 1inch Portfolio API',
    description: 'Fetch comprehensive wallet balances including ERC20 tokens and native tokens with USD values'
  })
  @ApiParam({ name: 'address', description: 'Wallet address', example: '0x742d35Cc6634C0532925a3b8E25bD4F6A26B1E4F' })
  @ApiQuery({ name: 'chainId', required: false, description: 'Chain ID (1=Ethereum, 137=Polygon, 56=BSC)', example: 1 })
  @ApiResponse({ status: 200, description: 'Wallet balances retrieved successfully' })
  async getWalletBalances(
    @Param('address') address: string,
    @Query('chainId') chainId?: number,
  ): Promise<WalletBalances> {
    try {
      this.logger.log(`Fetching balances for address: ${address}, chainId: ${chainId || 1}`);
      return await this.oneinchService.getWalletBalances(address, chainId || 1);
    } catch (error) {
      this.logger.error(`Failed to fetch wallet balances: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch wallet balances',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('balances/:address/multi-chain')
  @ApiOperation({ 
    summary: 'Get multi-chain wallet balances',
    description: 'Fetch wallet balances across multiple supported chains (Ethereum, Polygon, BSC)'
  })
  @ApiParam({ name: 'address', description: 'Wallet address', example: '0x742d35Cc6634C0532925a3b8E25bD4F6A26B1E4F' })
  @ApiResponse({ status: 200, description: 'Multi-chain balances retrieved successfully' })
  async getMultiChainBalances(
    @Param('address') address: string,
  ): Promise<WalletBalances[]> {
    try {
      this.logger.log(`Fetching multi-chain balances for address: ${address}`);
      return await this.oneinchService.getMultiChainBalances(address);
    } catch (error) {
      this.logger.error(`Failed to fetch multi-chain balances: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch multi-chain balances',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('token/:address')
  @ApiOperation({ 
    summary: 'Get token metadata using 1inch Token API',
    description: 'Fetch detailed token information including symbol, name, decimals, and verification status'
  })
  @ApiParam({ name: 'address', description: 'Token contract address', example: '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5' })
  @ApiQuery({ name: 'chainId', required: false, description: 'Chain ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Token metadata retrieved successfully' })
  async getTokenMetadata(
    @Param('address') address: string,
    @Query('chainId') chainId?: number,
  ): Promise<TokenMetadata> {
    try {
      this.logger.log(`Fetching token metadata for: ${address}, chainId: ${chainId || 1}`);
      return await this.oneinchService.getTokenMetadata(address, chainId || 1);
    } catch (error) {
      this.logger.error(`Failed to fetch token metadata: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch token metadata',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('price')
  @ApiOperation({ 
    summary: 'Get spot price using 1inch Price API',
    description: 'Get real-time exchange rate between two tokens'
  })
  @ApiQuery({ name: 'fromToken', description: 'Source token address', example: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' })
  @ApiQuery({ name: 'toToken', description: 'Destination token address', example: '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5' })
  @ApiQuery({ name: 'amount', description: 'Amount in smallest token unit (wei)', example: '1000000000000000000' })
  @ApiQuery({ name: 'chainId', required: false, description: 'Chain ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Spot price retrieved successfully' })
  async getSpotPrice(
    @Query('fromToken') fromToken: string,
    @Query('toToken') toToken: string,
    @Query('amount') amount: string,
    @Query('chainId') chainId?: number,
  ): Promise<SpotPrice> {
    try {
      this.logger.log(`Fetching spot price: ${fromToken} -> ${toToken}, amount: ${amount}`);
      
      if (!fromToken || !toToken || !amount) {
        throw new HttpException(
          'Missing required parameters: fromToken, toToken, amount',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.oneinchService.getSpotPrice(
        fromToken,
        toToken,
        amount,
        chainId || 1,
      );
    } catch (error) {
      this.logger.error(`Failed to fetch spot price: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch spot price',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tokens')
  @ApiOperation({ 
    summary: 'Get supported tokens for a chain',
    description: 'Retrieve list of all supported tokens on a specific blockchain'
  })
  @ApiQuery({ name: 'chainId', required: false, description: 'Chain ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Supported tokens retrieved successfully' })
  async getSupportedTokens(
    @Query('chainId') chainId?: number,
  ): Promise<TokenMetadata[]> {
    try {
      this.logger.log(`Fetching supported tokens for chainId: ${chainId || 1}`);
      return await this.oneinchService.getSupportedTokens(chainId || 1);
    } catch (error) {
      this.logger.error(`Failed to fetch supported tokens: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch supported tokens',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('convert')
  @ApiOperation({ 
    summary: 'Convert amount between tokens',
    description: 'Convert a specific amount from one token to another using 1inch rates'
  })
  @ApiQuery({ name: 'fromToken', description: 'Source token address', example: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' })
  @ApiQuery({ name: 'toToken', description: 'Destination token address', example: '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5' })
  @ApiQuery({ name: 'amount', description: 'Amount to convert', example: '1000000000000000000' })
  @ApiQuery({ name: 'chainId', required: false, description: 'Chain ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Amount converted successfully' })
  async convertAmount(
    @Query('fromToken') fromToken: string,
    @Query('toToken') toToken: string,
    @Query('amount') amount: string,
    @Query('chainId') chainId?: number,
  ): Promise<{ fromAmount: string; toAmount: string; rate: number }> {
    try {
      this.logger.log(`Converting amount: ${amount} from ${fromToken} to ${toToken}`);
      
      if (!fromToken || !toToken || !amount) {
        throw new HttpException(
          'Missing required parameters: fromToken, toToken, amount',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.oneinchService.convertAmount(
        fromToken,
        toToken,
        amount,
        chainId || 1,
      );
    } catch (error) {
      this.logger.error(`Failed to convert amount: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to convert amount',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ 
    summary: '1inch API health check',
    description: 'Check the health status of 1inch API integration'
  })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async healthCheck(): Promise<{ status: string; api1inch: boolean }> {
    try {
      return await this.oneinchService.healthCheck();
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return { status: 'unhealthy', api1inch: false };
    }
  }

  @Get('stats/user/:address')
  @ApiOperation({ 
    summary: 'Get comprehensive user statistics',
    description: 'Get user portfolio summary across multiple chains with 1inch data'
  })
  @ApiParam({ name: 'address', description: 'User wallet address', example: '0x742d35Cc6634C0532925a3b8E25bD4F6A26B1E4F' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  async getUserStats(
    @Param('address') address: string,
  ): Promise<{
    address: string;
    totalValueUsd: number;
    chainsCount: number;
    tokensCount: number;
    chains: WalletBalances[];
    topTokens: any[];
  }> {
    try {
      this.logger.log(`Fetching comprehensive stats for user: ${address}`);
      
      const multiChainBalances = await this.oneinchService.getMultiChainBalances(address);
      
      let totalValueUsd = 0;
      let totalTokensCount = 0;
      const allTokens: any[] = [];

      multiChainBalances.forEach(chainData => {
        totalValueUsd += chainData.totalValueUsd;
        totalTokensCount += chainData.tokens.length;
        
        // Add native token to all tokens list
        allTokens.push({
          ...chainData.nativeToken,
          chainId: chainData.chainId,
          tokenAddress: 'native',
        });
        
        // Add ERC20 tokens
        chainData.tokens.forEach(token => {
          allTokens.push({
            ...token,
            chainId: chainData.chainId,
          });
        });
      });

      // Sort tokens by value and take top 10
      const topTokens = allTokens
        .sort((a, b) => b.valueUsd - a.valueUsd)
        .slice(0, 10);

      return {
        address,
        totalValueUsd,
        chainsCount: multiChainBalances.length,
        tokensCount: totalTokensCount,
        chains: multiChainBalances,
        topTokens,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch user stats: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to fetch user stats',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}