import { Near, Account, keyStores, Contract } from 'near-api-js';
import { SwapEvent, HTLCLock } from '../types';
import { config } from '../config';
import { SecretExtractor } from './secret-extractor';
import winston from 'winston';

const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'relayer.log' })
  ],
});

interface HTLCContract extends Contract {
  initiate_swap(args: {
    receiver: string;
    hashlock: string;
    timelock: number;
    eth_tx_hash?: string;
  }, gas?: string, deposit?: string): Promise<string>;
  
  claim_swap(args: {
    swap_id: string;
    secret: string;
    amount: string; // U128 as string
  }, gas?: string): Promise<any>;
  
  refund_swap(args: {
    swap_id: string;
  }, gas?: string): Promise<any>;
  
  get_swap(args: {
    swap_id: string;
  }): Promise<any>;
  
  get_swap_status(args: {
    swap_id: string;
  }): Promise<any>;
}

export class NearExecutor {
  private near: Near;
  private account: Account;
  private contract: HTLCContract;
  private secretExtractor: SecretExtractor;

  constructor() {
    this.secretExtractor = new SecretExtractor(config.ethereum.rpcUrl);
    this.initializeNear();
  }

  private async initializeNear(): Promise<void> {
    try {
      // Configuration NEAR
      const keyStore = new keyStores.InMemoryKeyStore();
      
      // Note: En production, utilisez keyStores.UnencryptedFileSystemKeyStore
      // ou un autre mécanisme sécurisé pour gérer les clés
      
      this.near = new Near({
        networkId: config.near.networkId,
        keyStore,
        nodeUrl: this.getNodeUrl(),
        walletUrl: this.getWalletUrl(),
        helperUrl: this.getHelperUrl(),
      });

      this.account = await this.near.account(config.near.accountId);
      
      // Initialiser le contrat HTLC
      this.contract = new Contract(
        this.account,
        config.near.contractId,
        {
          viewMethods: ['get_swap', 'get_swap_status', 'get_swaps_by_account'],
          changeMethods: ['initiate_swap', 'claim_swap', 'refund_swap'],
        }
      ) as HTLCContract;

      logger.info('Connexion NEAR établie avec succès');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation NEAR:', error);
      throw error;
    }
  }

  private getNodeUrl(): string {
    return config.near.networkId === 'mainnet' 
      ? 'https://rpc.mainnet.near.org'
      : 'https://rpc.testnet.near.org';
  }

  private getWalletUrl(): string {
    return config.near.networkId === 'mainnet'
      ? 'https://wallet.mainnet.near.org'
      : 'https://wallet.testnet.near.org';
  }

  private getHelperUrl(): string {
    return config.near.networkId === 'mainnet'
      ? 'https://helper.mainnet.near.org'
      : 'https://helper.testnet.near.org';
  }

  async executeSwapAction(swapEvent: SwapEvent): Promise<void> {
    try {
      switch (swapEvent.status) {
        case 'locked':
          await this.createHTLC(swapEvent);
          break;
        case 'released':
          await this.claimHTLC(swapEvent);
          break;
        case 'refunded':
          await this.refundHTLC(swapEvent);
          break;
        default:
          logger.warn(`Action non supportée pour le statut: ${swapEvent.status}`);
      }
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de l'action NEAR pour ${swapEvent.id}:`, error);
      throw error;
    }
  }

  private async createHTLC(swapEvent: SwapEvent): Promise<void> {
    logger.info(`Création du swap sur NEAR pour ${swapEvent.id}`);

    try {
      const result = await this.contract.initiate_swap(
        {
          receiver: swapEvent.userAddress,
          hashlock: swapEvent.secretHash,
          timelock: swapEvent.timelock,
          eth_tx_hash: swapEvent.txHash,
        },
        '300000000000000', // Gas: 300 TGas
        swapEvent.amount // Deposit: montant du swap
      );

      logger.info(`Swap créé avec succès sur NEAR - ID: ${result}`);
    } catch (error) {
      logger.error('Erreur lors de la création du swap:', error);
      throw error;
    }
  }

  private async claimHTLC(swapEvent: SwapEvent): Promise<void> {
    logger.info(`Réclamation du swap sur NEAR pour ${swapEvent.id}`);

    try {
      // Récupérer le secret de la transaction Ethereum
      const secret = await this.secretExtractor.extractSecret(swapEvent.txHash || '');
      
      const result = await this.contract.claim_swap(
        {
          swap_id: swapEvent.id,
          secret: secret,
          amount: swapEvent.amount,
        },
        '100000000000000' // Gas: 100 TGas
      );

      logger.info(`Swap réclamé avec succès sur NEAR:`, result);
    } catch (error) {
      logger.error('Erreur lors de la réclamation du swap:', error);
      throw error;
    }
  }

  private async refundHTLC(swapEvent: SwapEvent): Promise<void> {
    logger.info(`Remboursement du swap sur NEAR pour ${swapEvent.id}`);

    try {
      const result = await this.contract.refund_swap(
        {
          swap_id: swapEvent.id,
        },
        '100000000000000' // Gas: 100 TGas
      );

      logger.info(`Swap remboursé avec succès sur NEAR:`, result);
    } catch (error) {
      logger.error('Erreur lors du remboursement du swap:', error);
      throw error;
    }
  }

  // Fonction supprimée - utilise SecretExtractor à la place

  async getHTLCStatus(swapId: string): Promise<any> {
    try {
      const swap = await this.contract.get_swap_status({ swap_id: swapId });
      return swap;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du swap ${swapId}:`, error);
      throw error;
    }
  }

  async monitorNearEvents(): Promise<void> {
    logger.info('Démarrage du monitoring des événements NEAR...');
    
    // Surveiller les événements NEAR (claims, refunds, etc.)
    // Cette implémentation dépend de la façon dont les événements
    // sont émis par le contrat NEAR
    
    setInterval(async () => {
      try {
        // Récupérer les nouveaux événements NEAR
        // et déclencher les actions correspondantes sur Ethereum
        await this.checkNearEvents();
      } catch (error) {
        logger.error('Erreur lors du monitoring NEAR:', error);
      }
    }, config.monitoring.pollInterval);
  }

  private async checkNearEvents(): Promise<void> {
    // Implémentation du monitoring des événements NEAR
    // À adapter selon l'API NEAR et les événements du contrat
    logger.debug('Vérification des nouveaux événements NEAR...');
  }
}