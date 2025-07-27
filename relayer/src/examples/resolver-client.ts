/**
 * Exemple d'utilisation du Resolver API
 * Ce fichier montre comment interagir avec le resolver off-chain
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

interface ResolverRequest {
  swapId: string;
  secret: string;
  claimAmount: string;
  claimer: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

class ResolverClient {
  private resolverUrl: string;
  private wallet: ethers.Wallet;

  constructor(resolverUrl: string, privateKey: string) {
    this.resolverUrl = resolverUrl;
    this.wallet = new ethers.Wallet(privateKey);
  }

  /**
   * Résout un swap en créant une demande signée
   */
  async resolveSwap(
    swapId: string,
    secret: string,
    claimAmount: string
  ): Promise<any> {
    try {
      // Créer la demande
      const request = await this.createResolverRequest(swapId, secret, claimAmount);
      
      console.log('📤 Envoi de la demande de résolution:', {
        swapId: request.swapId,
        claimer: request.claimer,
        amount: request.claimAmount
      });

      // Envoyer au resolver
      const response = await fetch(`${this.resolverUrl}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Swap résolu avec succès!');
        console.log('📋 Détails:', {
          txHash: result.data.txHash,
          gasUsed: result.data.gasUsed,
          executionTime: `${result.data.executionTime}ms`,
          conditions: result.data.validatedConditions
        });
        return result.data;
      } else {
        console.error('❌ Échec de la résolution:', result.error);
        if (result.failedConditions) {
          console.error('🚫 Conditions échouées:', result.failedConditions);
        }
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('💥 Erreur lors de la résolution:', error);
      throw error;
    }
  }

  /**
   * Vérifie le statut d'un swap
   */
  async getSwapStatus(swapId: string): Promise<any> {
    try {
      const response = await fetch(`${this.resolverUrl}/swap/${swapId}`);
      const result = await response.json();

      if (result.success) {
        console.log('📊 Statut du swap:', result.data);
        return result.data;
      } else {
        console.error('❌ Erreur lors de la récupération du statut:', result.error);
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('💥 Erreur lors de la récupération du statut:', error);
      throw error;
    }
  }

  /**
   * Créer une demande de résolution signée
   */
  private async createResolverRequest(
    swapId: string,
    secret: string,
    claimAmount: string
  ): Promise<ResolverRequest> {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const claimer = this.wallet.address;

    // Construire le message à signer
    const message = [
      `Fusion+ Swap Resolution`,
      `Swap ID: ${swapId}`,
      `Claimer: ${claimer}`,
      `Amount: ${claimAmount}`,
      `Timestamp: ${timestamp}`,
      `Nonce: ${nonce}`
    ].join('\n');

    // Signer le message
    const signature = await this.wallet.signMessage(message);

    return {
      swapId,
      secret,
      claimAmount,
      claimer,
      signature,
      timestamp,
      nonce
    };
  }

  /**
   * Obtenir les statistiques du resolver
   */
  async getResolverStats(): Promise<any> {
    try {
      const response = await fetch(`${this.resolverUrl}/stats`);
      const result = await response.json();

      if (result.success) {
        console.log('📈 Statistiques du resolver:', result.data);
        return result.data;
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('💥 Erreur lors de la récupération des stats:', error);
      throw error;
    }
  }
}

// Exemple d'utilisation
async function exempleUtilisation() {
  const resolverUrl = 'http://localhost:3001';
  const privateKey = '0x' + '1'.repeat(64); // Remplacer par une vraie clé privée
  
  const client = new ResolverClient(resolverUrl, privateKey);

  try {
    // 1. Vérifier le statut d'un swap
    console.log('🔍 Vérification du statut du swap...');
    const swapId = 'exemple_swap_id_123';
    await client.getSwapStatus(swapId);

    // 2. Résoudre un swap
    console.log('⚡ Résolution du swap...');
    const secret = 'mon_secret_123';
    const claimAmount = '1000000000000000000000000'; // 1 NEAR en yoctoNEAR
    
    const result = await client.resolveSwap(swapId, secret, claimAmount);
    console.log('🎉 Résolution terminée!', result);

    // 3. Obtenir les statistiques
    console.log('📊 Statistiques du resolver...');
    await client.getResolverStats();

  } catch (error) {
    console.error('❌ Erreur dans l\'exemple:', error);
  }
}

// Exporter pour utilisation
export { ResolverClient, exempleUtilisation };

// Exécuter l'exemple si ce fichier est appelé directement
if (require.main === module) {
  exempleUtilisation().catch(console.error);
}