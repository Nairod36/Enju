import { ethers } from 'ethers';
import { ResolverRequest, ResolverCondition, ResolverResult, SwapResolutionEvent } from '../types/resolver';
import { NearExecutor } from './near-executor';
import { config } from '../config';
import winston from 'winston';
import crypto from 'crypto';

const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'resolver.log' })
  ],
});

export class FusionResolver {
  private nearExecutor: NearExecutor;
  private conditions: ResolverCondition[];
  private processedNonces: Set<string>;

  constructor(nearExecutor: NearExecutor) {
    this.nearExecutor = nearExecutor;
    this.processedNonces = new Set();
    this.initializeConditions();
  }

  private initializeConditions(): void {
    this.conditions = [
      {
        type: 'signature',
        description: 'Validate signature authenticity',
        validate: this.validateSignature.bind(this)
      },
      {
        type: 'timelock',
        description: 'Check timelock conditions',
        validate: this.validateTimelock.bind(this)
      },
      {
        type: 'amount',
        description: 'Verify claim amount validity',
        validate: this.validateAmount.bind(this)
      },
      {
        type: 'secret',
        description: 'Verify secret hash matches',
        validate: this.validateSecret.bind(this)
      },
      {
        type: 'custom',
        description: 'Custom business logic validation',
        validate: this.validateCustomLogic.bind(this)
      }
    ];
  }

  /**
   * Résout un swap en validant toutes les conditions et en exécutant sur NEAR
   */
  async resolveSwap(request: ResolverRequest): Promise<ResolverResult> {
    const startTime = Date.now();
    const result: ResolverResult = {
      success: false,
      validatedConditions: [],
      failedConditions: [],
      executionTime: 0
    };

    try {
      logger.info(`🔍 Résolution du swap ${request.swapId} pour ${request.claimer}`);

      // Vérifier le nonce pour éviter les replay attacks
      if (this.processedNonces.has(request.nonce)) {
        throw new Error('Nonce already used - replay attack prevention');
      }

      // Récupérer les données du swap
      const swapData = await this.nearExecutor.getHTLCStatus(request.swapId);
      if (!swapData) {
        throw new Error(`Swap ${request.swapId} not found`);
      }

      // Valider toutes les conditions
      for (const condition of this.conditions) {
        try {
          const isValid = await condition.validate(request, swapData);
          if (isValid) {
            result.validatedConditions.push(condition.description);
            logger.debug(`✅ Condition validée: ${condition.description}`);
          } else {
            result.failedConditions.push(condition.description);
            logger.warn(`❌ Condition échouée: ${condition.description}`);
          }
        } catch (error) {
          result.failedConditions.push(`${condition.description}: ${error}`);
          logger.error(`💥 Erreur dans la condition ${condition.description}:`, error);
        }
      }

      // Toutes les conditions doivent être validées
      if (result.failedConditions.length > 0) {
        throw new Error(`Conditions failed: ${result.failedConditions.join(', ')}`);
      }

      // Exécuter le claim sur NEAR
      const txResult = await this.executeClaimOnNear(request);
      
      // Marquer le nonce comme utilisé
      this.processedNonces.add(request.nonce);

      result.success = true;
      result.txHash = txResult.txHash;
      result.gasUsed = txResult.gasUsed;

      // Émettre l'événement de résolution
      await this.emitResolutionEvent({
        swapId: request.swapId,
        resolver: 'fusion-relayer',
        claimer: request.claimer,
        amount: request.claimAmount,
        conditions: result.validatedConditions,
        txHash: result.txHash!,
        timestamp: Date.now()
      });

      logger.info(`✅ Swap ${request.swapId} résolu avec succès - TX: ${result.txHash}`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Échec de la résolution du swap ${request.swapId}:`, error);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Valide la signature de la demande
   */
  private async validateSignature(request: ResolverRequest): Promise<boolean> {
    try {
      // Construire le message à signer
      const message = this.buildSignatureMessage(request);
      
      // Vérifier la signature
      const recoveredAddress = ethers.verifyMessage(message, request.signature);
      
      // Vérifier que l'adresse correspond au claimer
      const isValid = recoveredAddress.toLowerCase() === request.claimer.toLowerCase();
      
      if (!isValid) {
        logger.warn(`Signature invalide - Attendu: ${request.claimer}, Récupéré: ${recoveredAddress}`);
      }
      
      return isValid;
    } catch (error) {
      logger.error('Erreur lors de la validation de signature:', error);
      return false;
    }
  }

  /**
   * Valide les conditions de timelock
   */
  private async validateTimelock(request: ResolverRequest, swapData: any): Promise<boolean> {
    const currentTime = Date.now() * 1_000_000; // Convert to nanoseconds
    
    // Le swap ne doit pas être expiré
    if (currentTime >= swapData.timelock) {
      logger.warn(`Swap expiré - Current: ${currentTime}, Timelock: ${swapData.timelock}`);
      return false;
    }

    // Vérifier que la demande n'est pas trop ancienne (5 minutes max)
    const requestAge = Date.now() - request.timestamp;
    if (requestAge > 5 * 60 * 1000) {
      logger.warn(`Demande trop ancienne - Age: ${requestAge}ms`);
      return false;
    }

    return true;
  }

  /**
   * Valide le montant réclamé
   */
  private async validateAmount(request: ResolverRequest, swapData: any): Promise<boolean> {
    const claimAmount = BigInt(request.claimAmount);
    const remainingAmount = BigInt(swapData.amount_remaining || '0');

    // Le montant doit être positif
    if (claimAmount <= 0n) {
      logger.warn('Montant de claim invalide (≤ 0)');
      return false;
    }

    // Le montant ne doit pas dépasser le restant
    if (claimAmount > remainingAmount) {
      logger.warn(`Montant trop élevé - Claim: ${claimAmount}, Restant: ${remainingAmount}`);
      return false;
    }

    logger.debug(`Validation montant - Claim: ${claimAmount}, Restant: ${remainingAmount}`);
    return true;
  }

  /**
   * Valide le secret contre le hashlock
   */
  private async validateSecret(request: ResolverRequest, swapData: any): Promise<boolean> {
    try {
      // Hasher le secret fourni
      const secretHash = crypto.createHash('sha256')
        .update(request.secret)
        .digest('hex');

      // Comparer avec le hashlock du swap
      const isValid = secretHash === swapData.hashlock;
      
      if (!isValid) {
        logger.warn(`Secret invalide - Hash: ${secretHash}, Attendu: ${swapData.hashlock}`);
      }

      return isValid;
    } catch (error) {
      logger.error('Erreur lors de la validation du secret:', error);
      return false;
    }
  }

  /**
   * Logique métier personnalisée
   */
  private async validateCustomLogic(request: ResolverRequest, swapData: any): Promise<boolean> {
    // Vérifier que le swap n'est pas déjà completé
    if (swapData.is_completed) {
      logger.warn('Swap déjà completé');
      return false;
    }

    // Vérifier que le swap n'est pas remboursé
    if (swapData.is_refunded) {
      logger.warn('Swap déjà remboursé');
      return false;
    }

    // Limite de montant minimum (0.001 NEAR)
    const minAmount = BigInt('1000000000000000000000'); // 0.001 NEAR in yoctoNEAR
    if (BigInt(request.claimAmount) < minAmount) {
      logger.warn(`Montant trop petit - Min: ${minAmount}, Actuel: ${request.claimAmount}`);
      return false;
    }

    return true;
  }

  /**
   * Exécute le claim sur NEAR
   */
  private async executeClaimOnNear(request: ResolverRequest): Promise<{txHash: string, gasUsed: string}> {
    try {
      // Créer un événement de swap pour l'exécuteur NEAR
      const swapEvent = {
        id: request.swapId,
        fromChain: 'ethereum' as const,
        toChain: 'near' as const,
        fromToken: '',
        toToken: '',
        amount: request.claimAmount,
        userAddress: request.claimer,
        secretHash: crypto.createHash('sha256').update(request.secret).digest('hex'),
        timelock: 0,
        status: 'locked' as const,
        timestamp: request.timestamp
      };

      // Exécuter sur NEAR via l'exécuteur
      await this.nearExecutor.executeSwapAction(swapEvent);

      // Dans un vrai cas, on récupérerait le hash de transaction
      // Pour l'instant, on simule
      return {
        txHash: `near_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        gasUsed: '100000000000000' // 100 TGas
      };
    } catch (error) {
      logger.error('Erreur lors de l\'exécution sur NEAR:', error);
      throw error;
    }
  }

  /**
   * Construit le message à signer pour la validation
   */
  private buildSignatureMessage(request: ResolverRequest): string {
    return [
      `Fusion+ Swap Resolution`,
      `Swap ID: ${request.swapId}`,
      `Claimer: ${request.claimer}`,
      `Amount: ${request.claimAmount}`,
      `Timestamp: ${request.timestamp}`,
      `Nonce: ${request.nonce}`
    ].join('\n');
  }

  /**
   * Émet un événement de résolution
   */
  private async emitResolutionEvent(event: SwapResolutionEvent): Promise<void> {
    logger.info('📡 Événement de résolution émis:', event);
    
    // Ici, vous pourriez :
    // - Sauvegarder en base de données
    // - Publier sur un message queue
    // - Notifier des webhooks
    // - Mettre à jour des métriques
  }

  /**
   * Nettoie les nonces anciens pour éviter la surcharge mémoire
   */
  public cleanupOldNonces(): void {
    // Dans un vrai système, vous stockeriez les nonces avec timestamps
    // et les nettoyeriez périodiquement
    if (this.processedNonces.size > 10000) {
      this.processedNonces.clear();
      logger.info('Nettoyage des nonces anciens effectué');
    }
  }

  /**
   * Statistiques du resolver
   */
  public getStats(): object {
    return {
      processedNonces: this.processedNonces.size,
      conditionsCount: this.conditions.length,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}