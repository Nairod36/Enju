import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetQuoteDto {
  @ApiProperty({ description: 'Source token address' })
  @IsString()
  src: string;

  @ApiProperty({ description: 'Destination token address' })
  @IsString()
  dst: string;

  @ApiProperty({ description: 'Amount in wei/token units' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ description: 'Fee in basis points (optional)' })
  @IsOptional()
  @IsString()
  fee?: string;

  @ApiPropertyOptional({ description: 'Slippage tolerance in percent', minimum: 0.1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  slippage?: number;
}

export class GetSwapDto extends GetQuoteDto {
  @ApiProperty({ description: 'Wallet address performing the swap' })
  @IsString()
  from: string;
}