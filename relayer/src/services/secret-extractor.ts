import { ethers } from 'ethers';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'secret-extractor.log' })
  ],
});

/**
 * Utilitaire pour extraire les secrets des transactions Ethereum
 */
export class SecretExtractor {
  private provider: ethers.JsonRpcProvider;
  private secretCache = new Map<string, string>();

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Extrait le secret d'une transaction Ethereum
   */
  async extractSecret(txHash: string): Promise<string> {
    try {
      // Vérifier le cache d'abord
      const cachedSecret = this.secretCache.get(txHash);
      if (cachedSecret) {
        logger.debug(`Secret trouvé en cache pour ${txHash}`);
        return cachedSecret;
      }

      logger.info(`Extraction du secret depuis la transaction ${txHash}`);
      
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx || !receipt) {
        throw new Error(`Transaction ${txHash} non trouvée`);
      }

      // 1. Chercher dans les événements émis
      const secretFromEvents = await this.extractFromEvents(receipt.logs);
      if (secretFromEvents) {
        this.cacheSecret(txHash, secretFromEvents);
        return secretFromEvents;
      }

      // 2. Chercher dans les données de transaction
      const secretFromCalldata = this.extractFromCalldata(tx.data);
      if (secretFromCalldata) {
        this.cacheSecret(txHash, secretFromCalldata);
        return secretFromCalldata;
      }

      // 3. Chercher dans les traces internes (si disponible)
      const secretFromTraces = await this.extractFromTraces(txHash);
      if (secretFromTraces) {
        this.cacheSecret(txHash, secretFromTraces);
        return secretFromTraces;
      }

      throw new Error(`Aucun secret trouvé dans la transaction ${txHash}`);
      
    } catch (error) {
      logger.error(`Erreur lors de l'extraction du secret:`, error);
      throw error;
    }
  }

  /**
   * Extrait le secret depuis les événements émis
   */
  private async extractFromEvents(logs: ethers.Log[]): Promise<string | null> {
    const eventInterfaces = [
      // 1inch Fusion+ events
      "event SwapClaimed(bytes32 indexed secretHash, bytes32 secret)",
      "event SecretRevealed(bytes32 indexed hash, bytes32 secret)",
      
      // Generic HTLC events
      "event ClaimWithSecret(bytes32 secret)",
      "event Claim(bytes32 secret)",
      
      // Custom events qui peuvent contenir le secret
      "event SecretUsed(bytes32 secret)",
      "event UnlockWithSecret(bytes32 indexed lockId, bytes32 secret)"
    ];

    for (const log of logs) {
      for (const eventAbi of eventInterfaces) {
        try {
          const iface = new ethers.Interface([eventAbi]);
          const parsed = iface.parseLog(log);
          
          if (parsed && parsed.args.secret) {
            const secret = parsed.args.secret;
            if (this.isValidSecret(secret)) {
              logger.info(`Secret trouvé dans l'événement ${parsed.name}: ${secret}`);
              return secret;
            }
          }
        } catch (error) {
          // Continuer avec l'interface suivante
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Extrait le secret depuis les données d'appel
   */
  private extractFromCalldata(calldata: string): string | null {
    if (!calldata || calldata === '0x' || calldata.length < 10) {
      return null;
    }

    try {
      // Supprimer le sélecteur de fonction (4 premiers bytes)
      const params = calldata.slice(10);
      
      // Chercher des patterns de 32 bytes qui ressemblent à un secret
      for (let i = 0; i <= params.length - 64; i += 2) {
        const potential = '0x' + params.slice(i, i + 64);
        
        if (this.isValidSecret(potential)) {
          logger.info(`Secret potentiel trouvé dans calldata: ${potential}`);
          return potential;
        }
      }

      // Essayer de décoder comme paramètres ABI
      return this.extractFromAbiDecoding(calldata);
      
    } catch (error) {
      logger.debug('Erreur lors de l\'extraction depuis calldata:', error);
      return null;
    }
  }

  /**
   * Décode les paramètres ABI pour trouver le secret
   */
  private extractFromAbiDecoding(calldata: string): string | null {
    const commonFunctionSignatures = [
      // claim functions
      "claim(bytes32 secret)",
      "claimSwap(bytes32 secret, uint256 amount)",
      "unlock(bytes32 secret)",
      "reveal(bytes32 secret)",
      
      // HTLC functions
      "claimHTLC(bytes32 secret)",
      "claimWithSecret(bytes32 lockId, bytes32 secret)"
    ];

    for (const signature of commonFunctionSignatures) {
      try {
        const iface = new ethers.Interface([`function ${signature}`]);
        const decoded = iface.decodeFunctionData(signature.split('(')[0], calldata);
        
        // Chercher le paramètre secret
        for (const param of decoded) {
          if (typeof param === 'string' && this.isValidSecret(param)) {
            logger.info(`Secret trouvé via décodage ABI (${signature}): ${param}`);
            return param;
          }
        }
      } catch (error) {
        // Continuer avec la signature suivante
        continue;
      }
    }

    return null;
  }

  /**
   * Extrait le secret depuis les traces internes (debug_traceTransaction)
   */
  private async extractFromTraces(txHash: string): Promise<string | null> {
    try {
      // Note: Cette fonctionnalité nécessite un nœud Ethereum avec debug_* APIs
      // Pas disponible sur tous les providers (Alchemy, Infura)
      
      const traces = await this.provider.send('debug_traceTransaction', [
        txHash,
        { tracer: 'callTracer' }
      ]);

      return this.searchSecretInTraces(traces);
      
    } catch (error) {
      logger.debug('Traces non disponibles ou erreur:', error);
      return null;
    }
  }

  /**
   * Recherche récursive dans les traces
   */
  private searchSecretInTraces(trace: any): string | null {
    if (trace.input) {
      const secret = this.extractFromCalldata(trace.input);
      if (secret) return secret;
    }

    if (trace.calls) {
      for (const call of trace.calls) {
        const secret = this.searchSecretInTraces(call);
        if (secret) return secret;
      }
    }

    return null;
  }

  /**
   * Valide qu'une chaîne est un secret valide
   */
  private isValidSecret(secret: string): boolean {
    if (!secret || typeof secret !== 'string') {
      return false;
    }

    // Doit être au format 0x + 64 caractères hex
    if (!secret.match(/^0x[0-9a-fA-F]{64}$/)) {
      return false;
    }

    // Ne doit pas être que des zéros
    if (secret === '0x' + '0'.repeat(64)) {
      return false;
    }

    // Ne doit pas être que des 1 ou f (patterns suspects)
    if (secret === '0x' + '1'.repeat(64) || secret === '0x' + 'f'.repeat(64)) {
      return false;
    }

    return true;
  }

  /**
   * Met en cache un secret
   */
  private cacheSecret(txHash: string, secret: string): void {
    this.secretCache.set(txHash, secret);
    
    // Nettoyage automatique du cache (garder les 1000 derniers)
    if (this.secretCache.size > 1000) {
      const firstKey = this.secretCache.keys().next().value;
      this.secretCache.delete(firstKey);
    }
    
    logger.debug(`Secret mis en cache pour ${txHash}`);
  }

  /**
   * Nettoie le cache
   */
  public clearCache(): void {
    this.secretCache.clear();
    logger.info('Cache des secrets nettoyé');
  }

  /**
   * Statistiques du cache
   */
  public getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.secretCache.size
    };
  }
}