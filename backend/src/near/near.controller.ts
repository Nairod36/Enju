import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NearService, NearCallFunctionRequest } from './near.service';

@ApiTags('Near')
@Controller('near')
export class NearController {
    constructor(private readonly nearService: NearService) { }

    @Post('rpc')
    @ApiOperation({ summary: 'Proxy NEAR RPC calls to avoid CORS' })
    @ApiResponse({ status: 200, description: 'RPC call successful' })
    async proxyRpc(@Body() rpcRequest: any): Promise<any> {
        return this.nearService.proxyNearRpc(rpcRequest);
    }

    @Post('call-function')
    @ApiOperation({ summary: 'Prepare NEAR function call' })
    @ApiResponse({ status: 200, description: 'Function call prepared' })
    async callFunction(@Body() request: NearCallFunctionRequest): Promise<any> {
        return this.nearService.callFunction(request);
    }

    @Get('account/:accountId')
    @ApiOperation({ summary: 'Get NEAR account info' })
    @ApiResponse({ status: 200, description: 'Account info retrieved' })
    async getAccount(@Param('accountId') accountId: string): Promise<any> {
        return this.nearService.getAccount(accountId);
    }

    @Post('view-function')
    @ApiOperation({ summary: 'Call NEAR view function' })
    @ApiResponse({ status: 200, description: 'View function called' })
    async viewFunction(@Body() request: { contractId: string; method: string; args?: any }): Promise<any> {
        return this.nearService.viewFunction(request.contractId, request.method, request.args);
    }

    @Post('send-transaction')
    @ApiOperation({ summary: 'Send signed NEAR transaction' })
    @ApiResponse({ status: 200, description: 'Transaction sent' })
    async sendTransaction(@Body() request: { signedTransaction: string }): Promise<any> {
        return this.nearService.sendTransaction(request.signedTransaction);
    }
}