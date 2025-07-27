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

  private async getSecretFromEthereumTx(txHash: string): Promise<string> {
    try {
      logger.info(`Extraction du secret depuis la transaction ${txHash}`);
      
      // Créer un provider Ethereum pour récupérer la transaction
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(config.ethereum?.rpcUrl || 'https://eth-mainnet.g.alchemy.com/v2/demo');
      
      // Récupérer la transaction et son receipt
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!tx || !receipt) {
        throw new Error(`Transaction ${txHash} non trouvée`);
      }
      
      // Analyser les logs pour trouver l'événement qui révèle le secret
      for (const log of receipt.logs) {
        try {
          // Interface pour décoder les événements qui révèlent le secret
          const iface = new ethers.Interface([
            "event SwapClaimed(bytes32 indexed secretHash, bytes32 secret)",
            "event SecretRevealed(bytes32 indexed hash, bytes32 secret)",
            "event ClaimWithSecret(bytes32 secret)"
          ]);
          
          const parsed = iface.parseLog(log);
          
          if (parsed && (parsed.name === 'SwapClaimed' || parsed.name === 'SecretRevealed' || parsed.name === 'ClaimWithSecret')) {
            const secret = parsed.args.secret;
            if (secret && secret !== '0x' + '0'.repeat(64)) {
              logger.info(`Secret trouvé dans l'événement ${parsed.name}: ${secret}`);
              return secret;
            }
          }
        } catch (parseError) {
          // Continuer si ce log n'est pas décodable
          continue;
        }
      }
      
      // Si aucun secret trouvé dans les logs, analyser les données de transaction
      if (tx.data && tx.data !== '0x') {
        // Essayer de décoder les données de transaction pour extraire le secret
        const secret = this.extractSecretFromCalldata(tx.data);
        if (secret) {
          logger.info(`Secret extrait des données de transaction: ${secret}`);
          return secret;
        }
      }
      
      throw new Error(`Aucun secret trouvé dans la transaction ${txHash}`);
      
    } catch (error) {
      logger.error(`Erreur lors de l'extraction du secret depuis ${txHash}:`, error);
      
      // En cas d'erreur, essayer de récupérer le secret depuis le cache/DB
      const cachedSecret = await this.getCachedSecret(txHash);
      if (cachedSecret) {
        return cachedSecret;
      }
      
      throw error;
    }
  }

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