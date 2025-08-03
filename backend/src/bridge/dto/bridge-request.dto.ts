import { IsString, IsNotEmpty, IsEnum, IsEthereumAddress, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SupportedChain {
  ETHEREUM = 'ethereum',
  TRON = 'tron',
  NEAR = 'near'
}

export class BridgeRequestDto {
  @ApiProperty({ 
    description: 'Amount to bridge',
    example: '1.5'
  })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ 
    enum: SupportedChain,
    description: 'Source blockchain'
  })
  @IsEnum(SupportedChain)
  fromChain: SupportedChain;

  @ApiProperty({ 
    enum: SupportedChain,
    description: 'Target blockchain'
  })
  @IsEnum(SupportedChain)
  toChain: SupportedChain;

  @ApiProperty({ 
    description: 'Ethereum address',
    example: '0x742d35Cc6634C0532925a3b8d54C3ca3e1f5d9b'
  })
  @IsEthereumAddress()
  @IsOptional()
  ethAddress?: string;

  @ApiProperty({ 
    description: 'Tron address (TR format)',
    example: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  })
  @IsString()
  @IsOptional()
  tronAddress?: string;

  @ApiProperty({ 
    description: 'NEAR account',
    example: 'user.testnet'
  })
  @IsString()
  @IsOptional()
  nearAccount?: string;
}

export class BridgeResponseDto {
  @ApiProperty({ description: 'Operation success status' })
  success: boolean;

  @ApiProperty({ description: 'Transaction hash', required: false })
  txHash?: string;

  @ApiProperty({ description: 'Swap identifier', required: false })
  swapId?: string;

  @ApiProperty({ description: 'Error message if failed', required: false })
  error?: string;
}