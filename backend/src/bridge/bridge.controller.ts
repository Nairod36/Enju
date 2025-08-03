import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BridgeService } from './bridge.service';
import { BridgeRequestDto, BridgeResponseDto } from './dto/bridge-request.dto';

@ApiTags('Bridge')
@Controller('api/bridge')
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  @Post('eth-to-tron')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bridge ETH to TRON' })
  @ApiBody({ type: BridgeRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Bridge request processed',
    type: BridgeResponseDto 
  })
  async bridgeEthToTron(@Body() request: BridgeRequestDto): Promise<BridgeResponseDto> {
    return this.bridgeService.processEthToTron(request);
  }

  @Post('tron-to-eth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bridge TRON to ETH' })
  @ApiBody({ type: BridgeRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Bridge request processed',
    type: BridgeResponseDto 
  })
  async bridgeTronToEth(@Body() request: BridgeRequestDto): Promise<BridgeResponseDto> {
    return this.bridgeService.processTronToEth(request);
  }

  @Post('near-to-eth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bridge NEAR to ETH' })
  @ApiBody({ type: BridgeRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Bridge request processed',
    type: BridgeResponseDto 
  })
  async bridgeNearToEth(@Body() request: BridgeRequestDto): Promise<BridgeResponseDto> {
    return this.bridgeService.processNearToEth(request);
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process any supported bridge route' })
  @ApiBody({ type: BridgeRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Bridge request processed',
    type: BridgeResponseDto 
  })
  async processBridge(@Body() request: BridgeRequestDto): Promise<BridgeResponseDto> {
    return this.bridgeService.processBridge(request);
  }
}