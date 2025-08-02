// src/users/dto/nonce-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class NonceResponseDto {
    @ApiProperty({
        description: 'Message to sign',
        example: 'Please sign this message to authenticate with Enju SwapForest: nonce-clp2x5f6d0000'
    })
    message: string;

    @ApiProperty({
        description: 'Raw nonce value',
        example: 'nonce-clp2x5f6d0000'
    })
    nonce: string;
}