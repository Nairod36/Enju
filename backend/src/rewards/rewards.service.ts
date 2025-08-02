import { Injectable } from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';

@Injectable()
export class RewardsService {
    constructor(private readonly rpcService: RpcService) {}
    // Ratios de récompense fixes (simples)
    private readonly REWARD_RATIOS = {
        ETH: 100,      // 1 ETH = 100 REWARD tokens
        NEAR: 0.068,   // 1 NEAR = 0.068 REWARD tokens  
        TRON: 0.00394, // 1 TRX = 0.00394 REWARD tokens
        TRX: 0.00394   // Alias pour TRON
    };

    // Adresse du contrat de récompense (à définir après déploiement)
    private readonly REWARD_TOKEN_ADDRESS = process.env.REWARD_TOKEN_ADDRESS || '';
    
    // Clé privée du propriétaire du contrat pour signer les transactions de mint
    private readonly REWARD_OWNER_PRIVATE_KEY = process.env.REWARD_TOKEN_OWNER_PRIVATE_KEY || '';

    /**
     * Calculer le montant de récompense pour un bridge
     */
    calculateReward(amount: number, tokenSymbol: string): number {
        const ratio = this.REWARD_RATIOS[tokenSymbol.toUpperCase()];
        if (!ratio) {
            console.warn(`Unknown token for rewards: ${tokenSymbol}`);
            return 0;
        }

        const rewardAmount = amount * ratio;
        console.log(`Bridge reward calculation: ${amount} ${tokenSymbol} = ${rewardAmount} REWARD tokens`);
        
        return rewardAmount;
    }

    /**
     * Mint des tokens de récompense pour un utilisateur
     */
    async mintRewardTokens(userAddress: string, amount: number, tokenSymbol: string): Promise<string | null> {
        const rewardAmount = this.calculateReward(amount, tokenSymbol);
        
        if (rewardAmount <= 0) {
            return null;
        }

        // Convertir en wei (18 decimals)
        const rewardAmountWei = BigInt(Math.floor(rewardAmount * 1e18));

        try {
            // Construire la transaction de mint
            const mintTransaction = await this.buildMintTransaction(
                userAddress, 
                rewardAmountWei
            );

            // Envoyer via RPC
            const txHash = await this.sendMintTransaction(mintTransaction);
            
            console.log(`Minted ${rewardAmount} REWARD tokens to ${userAddress}, tx: ${txHash}`);
            return txHash;

        } catch (error) {
            console.error('Failed to mint reward tokens:', error);
            return null;
        }
    }

    /**
     * Construire la transaction de mint
     */
    private async buildMintTransaction(userAddress: string, amountWei: bigint) {
        if (!this.REWARD_TOKEN_ADDRESS) {
            throw new Error('REWARD_TOKEN_ADDRESS not configured');
        }

        // ABI pour la fonction mintReward(address to, uint256 amount)
        const mintFunctionSignature = '0x40c10f19'; // mintReward(address,uint256)
        
        // Encoder les paramètres
        const paddedAddress = userAddress.slice(2).padStart(64, '0');
        const paddedAmount = amountWei.toString(16).padStart(64, '0');
        
        const data = mintFunctionSignature + paddedAddress + paddedAmount;

        return {
            to: this.REWARD_TOKEN_ADDRESS,
            data: data,
            value: '0x0',
            gas: '0x186A0', // 100k gas
        };
    }

    /**
     * Envoyer la transaction de mint via RPC
     */
    private async sendMintTransaction(transaction: any): Promise<string> {
        if (!this.REWARD_OWNER_PRIVATE_KEY) {
            throw new Error('REWARD_TOKEN_OWNER_PRIVATE_KEY not configured');
        }

        // Récupérer le nonce pour l'adresse du owner
        const ownerAddress = '0x0fDE14b58A5C20BaADf927c23B58810D35F41703'; // Votre adresse owner

        try {
            const nonceRequest = {
                jsonrpc: '2.0',
                method: 'eth_getTransactionCount',
                params: [ownerAddress, 'latest'],
                id: 1,
            };

            const nonceResponse = await this.rpcService.proxyToVpsRpc(nonceRequest);
            const nonce = nonceResponse.result;

            // Récupérer le gas price
            const gasPriceRequest = {
                jsonrpc: '2.0',
                method: 'eth_gasPrice',
                params: [],
                id: 2,
            };

            const gasPriceResponse = await this.rpcService.proxyToVpsRpc(gasPriceRequest);
            const gasPrice = gasPriceResponse.result;

            // Construire la transaction complète
            const fullTransaction = {
                from: ownerAddress,
                to: transaction.to,
                data: transaction.data,
                value: transaction.value,
                gas: transaction.gas,
                gasPrice: gasPrice,
                nonce: nonce,
            };

            // Envoyer la transaction (le fork local devrait accepter eth_sendTransaction)
            const sendRequest = {
                jsonrpc: '2.0',
                method: 'eth_sendTransaction',
                params: [fullTransaction],
                id: 3,
            };

            const result = await this.rpcService.proxyToVpsRpc(sendRequest);
            return result.result;

        } catch (error) {
            console.error('Failed to send mint transaction:', error);
            throw error;
        }
    }

    /**
     * Obtenir les stats de récompenses d'un utilisateur
     */
    async getUserRewardStats(userAddress: string) {
        // TODO: Implémenter la récupération des stats depuis la DB
        return {
            totalRewardsEarned: 0,
            currentBalance: 0,
            bridgeCount: 0
        };
    }

    /**
     * Obtenir le solde de tokens de récompense d'un utilisateur
     */
    async getUserRewardBalance(userAddress: string): Promise<string> {
        if (!this.REWARD_TOKEN_ADDRESS) {
            return '0';
        }

        try {
            // Appel balanceOf via RPC
            const balanceCall = {
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [
                    {
                        to: this.REWARD_TOKEN_ADDRESS,
                        data: '0x70a08231' + userAddress.slice(2).padStart(64, '0') // balanceOf(address)
                    },
                    'latest'
                ],
                id: 1
            };

            // TODO: Faire l'appel RPC réel
            return '0';

        } catch (error) {
            console.error('Failed to get reward balance:', error);
            return '0';
        }
    }
}