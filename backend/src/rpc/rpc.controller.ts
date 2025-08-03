import { Controller, Post, Body, HttpException, HttpStatus, Get, Query } from '@nestjs/common';
import { RpcService } from './rpc.service';

@Controller('rpc')
export class RpcController {
    constructor(private readonly rpcService: RpcService) { }

    @Post('eth')
    async proxyEthRpc(@Body() rpcRequest: any) {
        try {
            return await this.rpcService.proxyToVpsRpc(rpcRequest);
        } catch (error) {
            throw new HttpException(
                'Failed to proxy RPC request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('token-balance')
    async getTokenBalance(
        @Query('tokenAddress') tokenAddress: string,
        @Query('walletAddress') walletAddress: string,
    ) {
        try {
            if (!tokenAddress || !walletAddress) {
                throw new HttpException(
                    'tokenAddress and walletAddress are required',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const [balanceResult, decimalsResult] = await Promise.all([
                this.rpcService.getTokenBalance(tokenAddress, walletAddress),
                this.rpcService.getTokenDecimals(tokenAddress),
            ]);

            return {
                balance: balanceResult.result || '0x0',
                decimals: decimalsResult.result || '0x12', // Default to 18 decimals
            };
        } catch (error) {
            throw new HttpException(
                'Failed to fetch token balance',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('mint-eth')
    async mintEth(@Body() body: { address: string; amount?: string }) {
        try {
            if (!body.address) {
                throw new HttpException(
                    'address is required',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const result = await this.rpcService.mintEth(body.address, body.amount);
            
            return {
                success: true,
                data: {
                    txHash: result.result,
                    amount: body.amount || '0.1',
                    to: body.address
                }
            };
        } catch (error) {
            console.error('Mint ETH error:', error);
            throw new HttpException(
                'Failed to mint ETH',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
