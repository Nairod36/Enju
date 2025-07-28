import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsString, IsOptional, IsNumber } from 'class-validator';

export class ConnectWalletDto {
    @ApiProperty({
        description: 'Ethereum wallet address',
        example: '0x742d35Cc6634C0532925a3b8D4C0d4e3aeC6C31c'
    })
    @IsEthereumAddress()
    walletAddress: string;

    @ApiProperty({
        description: 'Signed message for authentication',
        example: '0x1234567890abcdef...'
    })
    @IsString()
    signature: string;

    @ApiProperty({
        description: 'Message that was signed',
        example: 'Please sign this message to authenticate: nonce-12345'
    })
    @IsString()
    message: string;

    @ApiPropertyOptional({
        description: 'Blockchain network chain ID',
        example: 1
    })
    @IsOptional()
    @IsNumber()
    chainId?: number;
}