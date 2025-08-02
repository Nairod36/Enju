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

    // Méthode pour minter de l'ETH (pour les tests sur le fork)
    async mintEth(toAddress: string, amount?: string): Promise<any> {
        // Montant par défaut : 0.1 ETH en wei
        const amountEth = amount ? parseFloat(amount) : 0.1;
        
        try {
            // D'abord, récupérer le solde actuel
            const balanceRequest = {
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [toAddress, 'latest'],
                id: 1,
            };

            const balanceResponse = await this.proxyToVpsRpc(balanceRequest);
            const currentBalance = BigInt(balanceResponse.result || '0x0');
            
            // Ajouter le montant demandé au solde actuel
            const newBalance = currentBalance + BigInt(amountEth * 1e18);
            const newBalanceHex = '0x' + newBalance.toString(16);

            // Essayer d'abord anvil_setBalance (Anvil)
            let setBalanceRequest = {
                jsonrpc: '2.0',
                method: 'anvil_setBalance',
                params: [toAddress, newBalanceHex],
                id: 2,
            };

            try {
                const result = await this.proxyToVpsRpc(setBalanceRequest);
                // Si anvil_setBalance fonctionne, créer un hash de transaction factice
                const fakeHash = '0x' + Math.random().toString(16).substring(2).padStart(64, '0');
                return { result: fakeHash };
            } catch (anvilError) {
                // Si anvil_setBalance échoue, essayer hardhat_setBalance (Hardhat)
                setBalanceRequest.method = 'hardhat_setBalance';
                
                try {
                    const result = await this.proxyToVpsRpc(setBalanceRequest);
                    const fakeHash = '0x' + Math.random().toString(16).substring(2).padStart(64, '0');
                    return { result: fakeHash };
                } catch (hardhatError) {
                    // Si les deux échouent, utiliser la méthode de transaction classique
                    return await this.sendEthTransaction(toAddress, amountEth);
                }
            }
        } catch (error) {
            console.error('Mint ETH error:', error);
            throw error;
        }
    }

    private async sendEthTransaction(toAddress: string, amountEth: number): Promise<any> {
        const faucetAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
        const amountWei = '0x' + BigInt(amountEth * 1e18).toString(16);

        // Récupérer le nonce
        const nonceRequest = {
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [faucetAddress, 'latest'],
            id: 1,
        };

        const nonceResponse = await this.proxyToVpsRpc(nonceRequest);
        const nonce = nonceResponse.result;

        // Récupérer le gas price
        const gasPriceRequest = {
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 2,
        };

        const gasPriceResponse = await this.proxyToVpsRpc(gasPriceRequest);
        const gasPrice = gasPriceResponse.result;

        // Créer la transaction
        const transaction = {
            from: faucetAddress,
            to: toAddress,
            value: amountWei,
            gas: '0x5208',
            gasPrice: gasPrice,
            nonce: nonce,
            data: '0x'
        };

        const sendRequest = {
            jsonrpc: '2.0',
            method: 'eth_sendTransaction',
            params: [transaction],
            id: 3,
        };

        return await this.proxyToVpsRpc(sendRequest);
    }
}
