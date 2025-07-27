import { SDK, HashLock } from '@1inch/cross-chain-sdk';
import { FUSION_CONFIG } from '../config/fusion-near';

/**
 * Service centralisé pour les interactions avec Fusion+
 */
export class FusionService {
  private static instance: FusionService;
  private sdk: SDK | null = null;

  private constructor() {}

  /**
   * Singleton pour éviter les créations multiples du SDK
   */
  public static getInstance(): FusionService {
    if (!FusionService.instance) {
      FusionService.instance = new FusionService();
    }
    return FusionService.instance;
  }

  /**
   * Initialise ou récupère l'instance du SDK Fusion+
   */
  public getSDK(): SDK {
    if (!this.sdk) {
      this.sdk = new SDK({
        url: FUSION_CONFIG.apiUrl,
        authKey: FUSION_CONFIG.authKey,
      });
    }
    return this.sdk;
  }

  /**
   * Crée un secret et son hash pour un swap
   */
  public createSecret(prefix: string = 'fusion_secret'): { secret: string; secretHash: string } {
    const secret = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const secretHash = HashLock.hashSecret(secret);
    return { secret, secretHash };
  }

  /**
   * Crée un HashLock pour un secret donné
   */
  public createHashLock(secret: string): any {
    return HashLock.forSingleFill(secret);
  }

  /**
   * Obtient un quote pour un swap cross-chain
   */
  public async getQuote(params: {
    srcChainId: number;
    dstChainId: number;
    srcTokenAddress: string;
    dstTokenAddress: string;
    amount: string;
    walletAddress: string;
  }) {
    const sdk = this.getSDK();
    return await sdk.getQuote(params);
  }

  /**
   * Crée un ordre Fusion+ avec les paramètres donnés
   */
  public async createOrder(quote: any, orderParams: {
    walletAddress: string;
    hashLock: any;
    secretHashes: string[];
    customParams?: any;
  }) {
    const sdk = this.getSDK();
    return await sdk.createOrder(quote, orderParams);
  }

  /**
   * Récupère les ordres actifs pour une adresse
   */
  public async getActiveOrders(walletAddress: string) {
    const sdk = this.getSDK();
    return await sdk.getActiveOrders({ walletAddress });
  }

  /**
   * Valide la configuration du service
   */
  public validateConfig(): boolean {
    return !!(FUSION_CONFIG.apiUrl && FUSION_CONFIG.authKey);
  }

  /**
   * Nettoie les ressources du service
   */
  public cleanup(): void {
    this.sdk = null;
  }
}

// Export d'une instance par défaut pour faciliter l'utilisation
export const fusionService = FusionService.getInstance();