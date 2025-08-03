import { Controller, Get, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OneInchService, SwapQuote, TokenInfo } from './oneinch.service';
import { GetQuoteDto, GetSwapDto } from './dto/swap.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('1inch')
@Controller('oneinch')
export class OneInchController {
  private readonly logger = new Logger(OneInchController.name);

  constructor(private readonly oneInchService: OneInchService) {}

  @Get('quote')
  @ApiOperation({ summary: 'Get swap quote from 1inch' })
  @ApiResponse({ status: 200, description: 'Swap quote retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getQuote(@Query() getQuoteDto: GetQuoteDto): Promise<SwapQuote> {
    this.logger.log(`Getting quote for ${getQuoteDto.src} to ${getQuoteDto.dst}`);
    
    return this.oneInchService.getQuote(
      getQuoteDto.src,
      getQuoteDto.dst,
      getQuoteDto.amount,
      getQuoteDto.fee,
      getQuoteDto.slippage,
    );
  }

  @Get('swap')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get swap transaction data from 1inch' })
  @ApiResponse({ status: 200, description: 'Swap transaction data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getSwap(@Query() getSwapDto: GetSwapDto): Promise<SwapQuote> {
    this.logger.log(`Getting swap data for ${getSwapDto.from}`);
    
    return this.oneInchService.getSwap(
      getSwapDto.src,
      getSwapDto.dst,
      getSwapDto.amount,
      getSwapDto.from,
      getSwapDto.slippage,
      getSwapDto.fee,
    );
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Get supported tokens from 1inch' })
  @ApiResponse({ status: 200, description: 'Supported tokens retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getTokens(): Promise<Record<string, TokenInfo>> {
    this.logger.log('Getting supported tokens');
    return this.oneInchService.getTokens();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check 1inch service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async getHealth(): Promise<{ status: string; timestamp: number }> {
    return this.oneInchService.getHealthCheck();
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify backend is running' })
  @ApiResponse({ status: 200, description: 'Backend is running' })
  async test(): Promise<{ message: string; timestamp: number }> {
    this.logger.log('Test endpoint called');
    return {
      message: 'Backend is running!',
      timestamp: Date.now(),
    };
  }
}