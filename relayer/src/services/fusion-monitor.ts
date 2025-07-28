import { ethers } from 'ethers';
import { config } from '../config';
import { NearExecutor } from './near-executor';
import { createLogger } from '../utils/logger';

const logger = createLogger('fusion-monitor');

interface FusionOrderEvent {
  orderId: string;
  secretHash: string;
  nearRecipient: string;
  timelock: number;
  amount: string;
  fromToken: string;
  toToken: string;
  txHash?: string;
}

/**
 * Surveille spécifiquement les ordres Fusion+ avec extension NEAR
 */
export class FusionMonitor {
  private provider: ethers.JsonRpcProvider;
  private nearExecutor: NearExecutor;
  private lastProcessedBlock: number = 0;
  private processingOrders = new Set<string>();

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.nearExecutor = new NearExecutor();
  }

  /**
   * Démarre la surveillance des événements Fusion+
   */
  async start(): Promise<void> {
    logger.info('🔍 Démarrage du monitoring Fusion+ → NEAR...');
    
    // Récupérer le dernier bloc traité
    this.lastProcessedBlock = await this.provider.getBlockNumber() - 5;
    
    // Démarrer la surveillance en temps réel
    this.startRealTimeMonitoring();
    
    // Polling des blocs pour backup
    this.startBlockPolling();
    
    logger.info('✅ Fusion Monitor démarré');
  }

  /**
   * Surveillance en temps réel des événements Fusion+
   */
  private startRealTimeMonitoring(): void {
    // Interface pour les événements Fusion+ que nous surveillons
    const fusionInterface = new ethers.Interface([
      // Événement principal quand un ordre est créé
      "event OrderCreated(bytes32 indexed orderId, address indexed maker, bytes32 secretHash, uint256 amount)",
      
      // Événement spécifique pour les ordres cross-chain
      "event CrossChainOrder(bytes32 indexed orderId, uint256 srcChainId, uint256 dstChainId, bytes32 secretHash)",
      
      // Événement quand l'ordre est lockée sur Ethereum
      "event OrderLocked(bytes32 indexed orderId, address token, uint256 amount, bytes32 secretHash)"
    ]);

    // Adresses des contrats Fusion+ (mainnet)
    const fusionContracts = [
      '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch v5 Router
      '0x111111125421ca6dc452d289314280a0f8842a65', // 1inch v4 Router
      // Ajouter d'autres contrats Fusion+ si nécessaire
    ];

    // Écouter les événements en temps réel
    fusionContracts.forEach(contractAddress => {
      const filter = {
        address: contractAddress,
        topics: [
          ethers.id("OrderCreated(bytes32,address,bytes32,uint256)"),
          null, // orderId (indexé)
          null, // maker (indexé) 
          null  // secretHash (non-indexé, sera dans data)
        ]
      };

      this.provider.on(filter, async (log) => {
        try {
          await this.processFusionEvent(log);
        } catch (error) {
          logger.error('Erreur lors du traitement de l\'événement Fusion+:', error);
        }
      });
    });

    logger.info('📡 Surveillance en temps réel des événements Fusion+ activée');
  }

  /**
   * Polling des blocs pour s'assurer qu'aucun événement n'est manqué
   */
  private startBlockPolling(): void {
    setInterval(async () => {
      try {
        await this.checkMissedEvents();
      } catch (error) {
        logger.error('Erreur lors du polling des blocs:', error);
      }
    }, config.monitoring.pollInterval);
  }

  /**
   * Traite un événement Fusion+ détecté
   */
  private async processFusionEvent(log: ethers.Log): Promise<void> {
    try {
      const fusionInterface = new ethers.Interface([
        "event OrderCreated(bytes32 indexed orderId, address indexed maker, bytes32 secretHash, uint256 amount)"
      ]);

      const parsed = fusionInterface.parseLog(log);
      if (!parsed) return;

      const orderId = parsed.args.orderId;
      
      // Éviter le double traitement
      if (this.processingOrders.has(orderId)) {
        return;
      }
      this.processingOrders.add(orderId);

      logger.info(`🎯 Ordre Fusion+ détecté: ${orderId}`);

      // Analyser si c'est un ordre cross-chain vers NEAR
      const orderDetails = await this.analyzeOrder(log, parsed);
      
      if (orderDetails && this.isNearOrder(orderDetails)) {
        logger.info(`🌿 Ordre NEAR confirmé: ${orderId}`);
        await this.createNearHTLC(orderDetails);
      } else {
        logger.debug(`⏭️ Ordre non-NEAR ignoré: ${orderId}`);
      }

    } catch (error) {
      logger.error('Erreur lors du traitement de l\'événement:', error);
    }
  }

  /**
   * Analyse les détails d'un ordre Fusion+
   */
  private async analyzeOrder(log: ethers.Log, parsed: any): Promise<FusionOrderEvent | null> {
    try {
      // Récupérer la transaction complète pour plus de détails
      const tx = await this.provider.getTransaction(log.transactionHash);
      if (!tx) return null;

      // Analyser les données de transaction pour détecter l'extension NEAR
      const nearExtension = this.extractNearExtension(tx.data);
      
      if (!nearExtension) {
        return null; // Pas un ordre NEAR
      }

      return {
        orderId: parsed.args.orderId,
        secretHash: parsed.args.secretHash,
        nearRecipient: nearExtension.recipient,
        timelock: nearExtension.timelock,
        amount: parsed.args.amount.toString(),
        fromToken: nearExtension.fromToken || 'ETH',
        toToken: nearExtension.toToken || 'NEAR',
        txHash: log.transactionHash
      };

    } catch (error) {
      logger.error('Erreur lors de l\'analyse de l\'ordre:', error);
      return null;
    }
  }

  /**
   * Extrait les données d'extension NEAR depuis les données de transaction
   */
  private extractNearExtension(txData: string): { recipient: string; timelock: number; fromToken?: string; toToken?: string } | null {
    try {
      // Dans une vraie implémentation, vous devriez :
      // 1. Décoder les paramètres customParams de Fusion+
      // 2. Chercher les marqueurs spécifiques à NEAR
      // 3. Extraire les données nécessaires
      
      // Pour la démo, on simule avec une logique simple
      if (txData.includes('6e656172')) { // "near" en hex
        return {
          recipient: 'alice.near', // À extraire vraiment des données
          timelock: Math.floor(Date.now() / 1000) + 3600, // 1 heure
          fromToken: 'ETH',
          toToken: 'NEAR'
        };
      }
      
      return null;
    } catch (error) {
      logger.debug('Extension NEAR non trouvée:', error);
      return null;
    }
  }

  /**
   * Vérifie si un ordre est destiné à NEAR
   */
  private isNearOrder(orderDetails: FusionOrderEvent): boolean {
    return orderDetails.nearRecipient.includes('.near') || 
           orderDetails.toToken === 'NEAR' ||
           orderDetails.nearRecipient.length === 64; // Adresse NEAR implicite
  }

  /**
   * Crée automatiquement le HTLC correspondant sur NEAR
   */
  private async createNearHTLC(orderDetails: FusionOrderEvent): Promise<void> {
    try {
      logger.info(`🔄 Création du HTLC sur NEAR pour l'ordre ${orderDetails.orderId}`);

      // Créer le swap event pour l'exécuteur NEAR
      const swapEvent = {
        id: orderDetails.orderId,
        fromChain: 'ethereum' as const,
        toChain: 'near' as const,
        fromToken: orderDetails.fromToken,
        toToken: orderDetails.toToken,
        amount: orderDetails.amount,
        userAddress: orderDetails.nearRecipient,
        secretHash: orderDetails.secretHash,
        timelock: orderDetails.timelock,
        status: 'locked' as const,
        txHash: orderDetails.txHash,
        timestamp: Date.now()
      };

      // Exécuter la création sur NEAR
      await this.nearExecutor.executeSwapAction(swapEvent);
      
      logger.info(`✅ HTLC créé sur NEAR pour l'ordre ${orderDetails.orderId}`);
      
      // Marquer comme traité
      this.processingOrders.delete(orderDetails.orderId);

    } catch (error) {
      logger.error(`❌ Erreur lors de la création HTLC NEAR:`, error);
      // Ne pas supprimer de processingOrders pour permettre un retry
    }
  }

  /**
   * Vérifie les événements manqués
   */
  private async checkMissedEvents(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    
    if (currentBlock <= this.lastProcessedBlock) {
      return;
    }

    // Traitement en batch pour éviter la surcharge
    const batchSize = 10;
    for (let block = this.lastProcessedBlock + 1; block <= currentBlock; block += batchSize) {
      const endBlock = Math.min(block + batchSize - 1, currentBlock);
      
      // Rechercher les événements Fusion+ dans cette plage
      const events = await this.provider.getLogs({
        fromBlock: block,
        toBlock: endBlock,
        topics: [ethers.id("OrderCreated(bytes32,address,bytes32,uint256)")]
      });

      for (const event of events) {
        await this.processFusionEvent(event);
      }
    }

    this.lastProcessedBlock = currentBlock;
  }

  /**
   * Webhook endpoint pour recevoir les notifications directes de l'UI
   */
  async handleWebhook(orderData: any): Promise<void> {
    try {
      logger.info('📨 Webhook reçu pour ordre:', orderData.orderId);

      const orderDetails: FusionOrderEvent = {
        orderId: orderData.orderId,
        secretHash: orderData.secretHash,
        nearRecipient: orderData.nearRecipient,
        timelock: orderData.timelock,
        amount: orderData.amount,
        fromToken: orderData.fromToken,
        toToken: orderData.toToken
      };

      // Créer immédiatement le HTLC sur NEAR
      await this.createNearHTLC(orderDetails);

    } catch (error) {
      logger.error('Erreur lors du traitement du webhook:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('🛑 Arrêt du Fusion Monitor...');
    this.provider.removeAllListeners();
  }
}