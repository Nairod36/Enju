import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { connect, keyStores, KeyPair, utils } from 'near-api-js';

export interface NearCallFunctionRequest {
    contractId: string;
    method: string;
    args: any;
    deposit: string;
    gas: string;
    accountId: string;
}

@Injectable()
export class NearService {
    private readonly logger = new Logger(NearService.name);
    private readonly NEAR_RPC_URL = 'https://rpc.testnet.near.org/';
    private readonly NEAR_NETWORK = 'testnet';
    private readonly PRIVATE_KEY = 'ed25519:2UJ8Li8GtQGk1HomoB3Mf7buGG7W15NwH4v8oy7PL5f2bHkk76ehsbXeP1L9kRTnDeFV5oL4MUUf1du6GqWEqfp5';
    private readonly SIGNER_ACCOUNT_ID = 'sharknadok.testnet';

    constructor(private readonly httpService: HttpService) { }

    async proxyNearRpc(rpcRequest: any): Promise<any> {
        try {
            const { contractId, method, args, gas, deposit } = rpcRequest;

            const keyStore = new keyStores.InMemoryKeyStore();
            const keyPair = KeyPair.fromString(this.PRIVATE_KEY);
            await keyStore.setKey(this.NEAR_NETWORK, this.SIGNER_ACCOUNT_ID, keyPair);

            const near = await connect({
                networkId: this.NEAR_NETWORK,
                nodeUrl: this.NEAR_RPC_URL,
                walletUrl: `https://wallet.${this.NEAR_NETWORK}.near.org`,
                deps: { keyStore },
            });

            const account = await near.account(this.SIGNER_ACCOUNT_ID);

            const result = await account.functionCall({
                contractId,
                methodName: method,
                args,
                gas: gas || '100000000000000',
                attachedDeposit: deposit || '0',
            });

            return {
                success: true,
                transaction: result.transaction,
                status: result.status,
            };
        } catch (error) {
            this.logger.error('❌ NEAR RPC function call error:', error);
            throw new BadRequestException(`NEAR RPC signed call failed: ${error.message}`);
        }
    }

    async callFunction(request: NearCallFunctionRequest): Promise<any> {
        try {
            this.logger.log(`📞 NEAR function call: ${request.method} on ${request.contractId}`);

            // This will be handled by the frontend wallet, but we can provide RPC proxying
            // The actual signing must be done by the wallet in the frontend
            return {
                success: true,
                message: 'Function call prepared - signature required from frontend wallet',
                request: request
            };
        } catch (error) {
            this.logger.error('NEAR function call error:', error);
            throw new BadRequestException(`NEAR function call failed: ${error.message}`);
        }
    }

    async getAccount(accountId: string): Promise<any> {
        const rpcRequest = {
            jsonrpc: '2.0',
            id: 'dontcare',
            method: 'query',
            params: {
                request_type: 'view_account',
                finality: 'final',
                account_id: accountId,
            },
        };

        return this.proxyNearRpc(rpcRequest);
    }

    async viewFunction(contractId: string, methodName: string, args: any = {}): Promise<any> {
        const rpcRequest = {
            jsonrpc: '2.0',
            id: 'dontcare',
            method: 'query',
            params: {
                request_type: 'call_function',
                finality: 'final',
                account_id: contractId,
                method_name: methodName,
                args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
            },
        };

        return this.proxyNearRpc(rpcRequest);
    }

    async sendTransaction(signedTransaction: string): Promise<any> {
        const rpcRequest = {
            jsonrpc: '2.0',
            id: 'dontcare',
            method: 'broadcast_tx_commit',
            params: [signedTransaction],
        };

        return this.proxyNearRpc(rpcRequest);
    }
}