import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class RpcService {
    private readonly VPS_RPC_URL = 'http://vps-b11044fd.vps.ovh.net/rpc';

    async proxyToVpsRpc(rpcRequest: any): Promise<any> {
        try {
            const response = await fetch(this.VPS_RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rpcRequest),
            });

            if (!response.ok) {
                throw new HttpException(
                    `VPS RPC error: ${response.status}`,
                    HttpStatus.BAD_GATEWAY,
                );
            }

            return await response.json();
        } catch (error) {
            console.error('RPC proxy error:', error);
            throw new HttpException(
                'Failed to connect to VPS RPC',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    // Méthode pour récupérer le solde d'un token ERC-20
    async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<any> {
        // balanceOf(address) function signature
        const functionSignature = '0x70a08231';
        // Pad wallet address to 32 bytes
        const paddedAddress = walletAddress.slice(2).padStart(64, '0');
        const data = functionSignature + paddedAddress;

        const rpcRequest = {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
                {
                    to: tokenAddress,
                    data: data,
                },
                'latest',
            ],
            id: 1,
        };

        return await this.proxyToVpsRpc(rpcRequest);
    }

    // Méthode pour récupérer les decimals d'un token ERC-20
    async getTokenDecimals(tokenAddress: string): Promise<any> {
        // decimals() function signature
        const functionSignature = '0x313ce567';

        const rpcRequest = {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
                {
                    to: tokenAddress,
                    data: functionSignature,
                },
                'latest',
            ],
            id: 1,
        };

        return await this.proxyToVpsRpc(rpcRequest);
    }
}
