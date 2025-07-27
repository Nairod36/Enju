import { NearExecutor } from './services/near-executor';
import { FusionResolver } from './services/resolver';
import { FusionMonitor } from './services/fusion-monitor';
import { NearMonitorService } from './services/near-monitor';
import { ResolverAPI } from './api/resolver-api';
import { config } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('main');

class FusionRelayer {
  private fusionMonitor: FusionMonitor;
  private nearMonitor: NearMonitorService;
  private nearExecutor: NearExecutor;
  private resolver: FusionResolver;
  private resolverAPI: ResolverAPI;
  private isRunning: boolean = false;

  constructor() {
    this.fusionMonitor = new FusionMonitor();
    this.nearMonitor = new NearMonitorService();
    this.nearExecutor = new NearExecutor();
    this.resolver = new FusionResolver(this.nearExecutor);
    this.resolverAPI = new ResolverAPI();
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Démarrage du Fusion Relayer...');
      
      this.isRunning = true;

      // Démarrer le monitoring Fusion+ (ETH→NEAR)
      await this.fusionMonitor.start();
      
      // Démarrer le monitoring NEAR (NEAR→ETH)
      await this.nearMonitor.startMonitoring();
      
      // Démarrer le monitoring NEAR executor
      await this.nearExecutor.monitorNearEvents();

      // Démarrer l'API resolver
      const resolverPort = parseInt(process.env.RESOLVER_PORT || '3001');
      this.resolverAPI.start(resolverPort);

      logger.info('✅ Fusion Relayer démarré avec succès');
      logger.info(`📊 Configuration:`, {
        fusionMonitoring: 'Active (ETH→NEAR)',
        nearMonitoring: 'Active (NEAR→ETH)',
        nearNetwork: config.near.networkId,
        nearContract: config.near.contractId,
        pollInterval: config.monitoring.pollInterval,
        resolverPort: resolverPort,
      });

      // Gérer l'arrêt propre
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('❌ Erreur lors du démarrage du relayer:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Arrêt du Fusion Relayer...');
    this.isRunning = false;

    try {
      await this.fusionMonitor.stop();
      this.nearMonitor.stopMonitoring();
      logger.info('✅ Fusion Relayer arrêté proprement');
    } catch (error) {
      logger.error('❌ Erreur lors de l\'arrêt:', error);
    }
  }

  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`📡 Signal ${signal} reçu, arrêt en cours...`);
        await this.stop();
        process.exit(0);
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('💥 Exception non gérée:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Promesse rejetée non gérée:', { reason, promise });
      this.stop().then(() => process.exit(1));
    });
  }

  getStatus(): object {
    return {
      running: this.isRunning,
      config: {
        fusionMonitoring: 'Active',
        nearNetwork: config.near.networkId,
        nearContract: config.near.contractId,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// Point d'entrée principal
async function main(): Promise<void> {
  const relayer = new FusionRelayer();
  await relayer.start();

  // Garder le processus en vie
  setInterval(() => {
    logger.debug('💓 Relayer en cours d\'exécution...');
  }, 60000); // Log de santé toutes les minutes
}

// Démarrer le relayer si ce fichier est exécuté directement
if (require.main === module) {
  main().catch((error) => {
    logger.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

export { FusionRelayer };