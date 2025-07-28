import express from 'express';
import { FusionResolver } from '../services/resolver';
import { NearExecutor } from '../services/near-executor';
import { FusionMonitor } from '../services/fusion-monitor';
import { NearMonitorService } from '../services/near-monitor';
import { ResolverRequest } from '../types/resolver';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'resolver-api.log' })
  ],
});

export class ResolverAPI {
  private app: express.Application;
  private resolver: FusionResolver;
  private nearExecutor: NearExecutor;
  private fusionMonitor: FusionMonitor;
  private nearMonitor: NearMonitorService;

  constructor() {
    this.app = express();
    this.nearExecutor = new NearExecutor();
    this.resolver = new FusionResolver(this.nearExecutor);
    this.fusionMonitor = new FusionMonitor();
    this.nearMonitor = new NearMonitorService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });

    this.app.use(limiter);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });

    // Resolver stats
    this.app.get('/stats', (req, res) => {
      try {
        const stats = this.resolver.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Error getting stats:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Resolve swap endpoint
    this.app.post('/resolve',
      [
        body('swapId').isString().isLength({ min: 1, max: 100 }),
        body('secret').isString().isLength({ min: 1, max: 200 }),
        body('claimAmount').isString().matches(/^[0-9]+$/),
        body('claimer').isString().isLength({ min: 1, max: 100 }),
        body('signature').isString().isLength({ min: 1, max: 200 }),
        body('timestamp').isInt({ min: 1 }),
        body('nonce').isString().isLength({ min: 1, max: 50 })
      ],
      async (req, res) => {
        try {
          // Validation des entrées
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              error: 'Validation failed',
              details: errors.array()
            });
          }

          const request: ResolverRequest = {
            swapId: req.body.swapId,
            secret: req.body.secret,
            claimAmount: req.body.claimAmount,
            claimer: req.body.claimer,
            signature: req.body.signature,
            timestamp: req.body.timestamp,
            nonce: req.body.nonce
          };

          logger.info(`🔍 Résolution demandée pour le swap ${request.swapId}`);

          // Résoudre le swap
          const result = await this.resolver.resolveSwap(request);

          if (result.success) {
            res.json({
              success: true,
              data: {
                txHash: result.txHash,
                gasUsed: result.gasUsed,
                executionTime: result.executionTime,
                validatedConditions: result.validatedConditions
              }
            });
          } else {
            res.status(400).json({
              success: false,
              error: result.error,
              failedConditions: result.failedConditions,
              executionTime: result.executionTime
            });
          }

        } catch (error) {
          logger.error('Error in resolve endpoint:', error);
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    );

    // Get swap status
    this.app.get('/swap/:swapId', async (req, res) => {
      try {
        const swapId = req.params.swapId;
        
        if (!swapId || swapId.length < 1 || swapId.length > 100) {
          return res.status(400).json({
            success: false,
            error: 'Invalid swap ID'
          });
        }

        const swapStatus = await this.nearExecutor.getHTLCStatus(swapId);
        
        if (swapStatus) {
          res.json({
            success: true,
            data: swapStatus
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Swap not found'
          });
        }

      } catch (error) {
        logger.error('Error getting swap status:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Webhook pour recevoir les ordres Fusion+ depuis l'UI
    this.app.post('/webhook/fusion-order',
      [
        body('orderId').isString().isLength({ min: 1, max: 100 }),
        body('secretHash').isString().isLength({ min: 1, max: 100 }),
        body('nearRecipient').isString().isLength({ min: 1, max: 100 }),
        body('timelock').isInt({ min: 1 }),
        body('amount').isString().matches(/^[0-9.]+$/),
        body('fromToken').isString().isLength({ min: 1, max: 20 }),
        body('toToken').isString().isLength({ min: 1, max: 20 })
      ],
      async (req, res) => {
        try {
          // Validation des entrées
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              error: 'Validation failed',
              details: errors.array()
            });
          }

          logger.info('📨 Webhook ordre Fusion+ reçu:', req.body);

          // Traiter l'ordre via le monitor
          await this.fusionMonitor.handleWebhook(req.body);

          res.json({
            success: true,
            message: 'Ordre traité avec succès'
          });

        } catch (error) {
          logger.error('Error processing fusion order webhook:', error);
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    );

    // Webhook pour recevoir les demandes de swap NEAR→ETH depuis l'UI
    this.app.post('/webhook/near-swap',
      [
        body('orderId').isString().isLength({ min: 1, max: 100 }),
        body('secretHash').isString().isLength({ min: 1, max: 100 }),
        body('ethRecipient').isString().isLength({ min: 1, max: 100 }),
        body('nearSender').isString().isLength({ min: 1, max: 100 }),
        body('timelock').isInt({ min: 1 }),
        body('amount').isString().matches(/^[0-9.]+$/),
        body('fromToken').isString().isLength({ min: 1, max: 20 }),
        body('toToken').isString().isLength({ min: 1, max: 20 }),
        body('direction').isString().equals('near-to-eth')
      ],
      async (req, res) => {
        try {
          // Validation des entrées
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              error: 'Validation failed',
              details: errors.array()
            });
          }

          logger.info('📨 Webhook swap NEAR→ETH reçu:', req.body);

          // Traiter la demande via le monitor NEAR
          await this.nearMonitor.handleNearWebhook(req.body);

          res.json({
            success: true,
            message: 'Demande de swap NEAR→ETH traitée avec succès'
          });

        } catch (error) {
          logger.error('Error processing NEAR→ETH swap webhook:', error);
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    );

    // Cleanup endpoint (admin only)
    this.app.post('/admin/cleanup', (req, res) => {
      try {
        // Dans un vrai système, vous ajouteriez une authentification admin
        this.resolver.cleanupOldNonces();
        
        res.json({
          success: true,
          message: 'Cleanup completed'
        });
      } catch (error) {
        logger.error('Error during cleanup:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  public async start(port: number = 3000): Promise<void> {
    // Démarrer le monitoring Fusion+
    await this.fusionMonitor.start();
    
    this.app.listen(port, () => {
      logger.info(`🚀 Resolver API started on port ${port}`);
      logger.info(`📖 Endpoints available:`);
      logger.info(`  GET  /health - Health check`);
      logger.info(`  GET  /stats - Resolver statistics`);
      logger.info(`  POST /resolve - Resolve a swap`);
      logger.info(`  GET  /swap/:id - Get swap status`);
      logger.info(`  POST /webhook/fusion-order - Receive ETH→NEAR orders`);
      logger.info(`  POST /webhook/near-swap - Receive NEAR→ETH orders`);
      logger.info(`  POST /admin/cleanup - Cleanup old nonces`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}