import express from 'express';
import cors from 'cors';
import { BridgeResolver } from '../services/bridge-resolver';
import { PriceOracle } from '../services/price-oracle';
import { ResolverConfig, SwapRequest } from '../types';

export class BridgeAPI {
  private app: express.Application;
  private resolver: BridgeResolver;
  private priceOracle: PriceOracle;
  private server: any;

  constructor(private config: ResolverConfig, private port: number) {
    this.app = express();
    this.resolver = new BridgeResolver(config);
    this.priceOracle = new PriceOracle();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        resolver: this.resolver.getStatus()
      });
    });

    // Get all bridges
    this.app.get('/bridges', (req, res) => {
      try {
        const bridges = this.resolver.getAllBridges();
        res.json({
          success: true,
          data: bridges,
          count: bridges.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get active bridges
    this.app.get('/bridges/active', (req, res) => {
      try {
        const bridges = this.resolver.getActiveBridges();
        res.json({
          success: true,
          data: bridges,
          count: bridges.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get specific bridge
    this.app.get('/bridges/:bridgeId', (req, res) => {
      try {
        const bridge = this.resolver.getBridge(req.params.bridgeId);
        if (!bridge) {
          return res.status(404).json({
            success: false,
            error: 'Bridge not found'
          });
        }
        
        res.json({
          success: true,
          data: bridge
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Initiate bridge manually
    this.app.post('/bridges/initiate', async (req, res) => {
      try {
        const request: SwapRequest = req.body;
        
        // Validate request
        if (!request.type || !request.amount || !request.hashlock || !request.timelock) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: type, amount, hashlock, timelock'
          });
        }

        const bridgeId = await this.resolver.initiateBridge(request);
        
        res.json({
          success: true,
          data: {
            bridgeId,
            message: 'Bridge initiated successfully'
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Complete bridge manually
    this.app.post('/bridges/:bridgeId/complete', async (req, res) => {
      try {
        const { secret } = req.body;
        
        if (!secret) {
          return res.status(400).json({
            success: false,
            error: 'Secret is required'
          });
        }

        await this.resolver.completeBridge(req.params.bridgeId, secret);
        
        res.json({
          success: true,
          message: 'Bridge completed successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Create NEAR HTLC directly
    this.app.post('/bridges/create-near-htlc', async (req, res) => {
      try {
        const { receiver, hashlock, timelock, ethAddress, amount } = req.body;
        
        if (!receiver || !hashlock || !timelock || !ethAddress || !amount) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: receiver, hashlock, timelock, ethAddress, amount'
          });
        }

        console.log('🚀 Creating NEAR HTLC via API:', { receiver, hashlock, timelock, ethAddress, amount });

        // Create NEAR HTLC using the resolver's NEAR client
        const contractId = await this.resolver.getNearListener().createCrossChainHTLC({
          receiver,
          hashlock,
          timelock,
          ethAddress,
          amount
        });
        
        res.json({
          success: true,
          data: {
            contractId,
            txHash: `near_tx_${Date.now()}`,
            message: 'NEAR HTLC created successfully'
          }
        });
      } catch (error) {
        console.error('❌ NEAR HTLC creation failed:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get resolver status
    this.app.get('/status', (req, res) => {
      res.json({
        success: true,
        data: this.resolver.getStatus()
      });
    });

    // Register secret for relayer (ETH → TRON bridges)
    this.app.post('/register-secret', async (req, res) => {
      try {
        const { hashlock, secret } = req.body;
        
        if (!hashlock || !secret) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: hashlock, secret'
          });
        }

        // Verify that the secret matches the hashlock
        const ethers = require('ethers');
        const computedHashlock = ethers.keccak256(secret);
        
        if (computedHashlock.toLowerCase() !== hashlock.toLowerCase()) {
          return res.status(400).json({
            success: false,
            error: 'Secret does not match the provided hashlock'
          });
        }

        // Register the secret in the resolver
        this.resolver.registerSecret(hashlock, secret);
        
        res.json({
          success: true,
          message: 'Secret registered successfully for relayer processing'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // ===== PRICE ORACLE ENDPOINTS =====
    
    // Get current prices
    this.app.get('/api/prices', async (req, res) => {
      try {
        const prices = await this.priceOracle.getCurrentPrices();
        res.json(prices);
      } catch (error) {
        console.error('Price fetch error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch prices'
        });
      }
    });

    // Convert amount between chains
    this.app.post('/api/convert', async (req, res) => {
      try {
        const { amount, fromChain, toChain } = req.body;

        if (!amount || !fromChain || !toChain) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: amount, fromChain, toChain'
          });
        }

        let convertedAmount: string;
        let exchangeRate: number;

        // Same chain conversion
        if (fromChain === toChain) {
          convertedAmount = amount;
          exchangeRate = 1;
        } else {
          // Cross-chain conversions
          if (fromChain === 'ethereum' && toChain === 'near') {
            convertedAmount = await this.priceOracle.convertEthToNear(amount);
            const prices = await this.priceOracle.getCurrentPrices();
            exchangeRate = prices.ethToNear;
          } else if (fromChain === 'near' && toChain === 'ethereum') {
            convertedAmount = await this.priceOracle.convertNearToEth(amount);
            const prices = await this.priceOracle.getCurrentPrices();
            exchangeRate = prices.nearToEth;
          } else if (fromChain === 'ethereum' && toChain === 'tron') {
            convertedAmount = await this.priceOracle.convertEthToTrx(amount);
            const prices = await this.priceOracle.getCurrentPrices();
            exchangeRate = prices.ethToTrx;
          } else if (fromChain === 'tron' && toChain === 'ethereum') {
            convertedAmount = await this.priceOracle.convertTrxToEth(amount);
            const prices = await this.priceOracle.getCurrentPrices();
            exchangeRate = prices.trxToEth;
          } else {
            return res.status(400).json({
              success: false,
              error: `Conversion not supported: ${fromChain} → ${toChain}`
            });
          }
        }

        res.json({
          success: true,
          convertedAmount,
          exchangeRate,
          fromChain,
          toChain,
          originalAmount: amount
        });
      } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Conversion failed'
        });
      }
    });

    // WebSocket-like endpoint for real-time updates
    this.app.get('/events', (req, res) => {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\\n\\n`);

      // Set up event listeners
      const onBridgeCreated = (bridge: any) => {
        res.write(`data: ${JSON.stringify({ type: 'bridgeCreated', data: bridge })}\\n\\n`);
      };

      const onBridgeCompleted = (bridge: any) => {
        res.write(`data: ${JSON.stringify({ type: 'bridgeCompleted', data: bridge })}\\n\\n`);
      };

      this.resolver.on('bridgeCreated', onBridgeCreated);
      this.resolver.on('bridgeCompleted', onBridgeCompleted);

      // Clean up on client disconnect
      req.on('close', () => {
        this.resolver.removeListener('bridgeCreated', onBridgeCreated);
        this.resolver.removeListener('bridgeCompleted', onBridgeCompleted);
      });
    });

    // Error handling
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  private setupEventHandlers(): void {
    this.resolver.on('bridgeCreated', (bridge) => {
      console.log(`🌉 Bridge created: ${bridge.id} (${bridge.type})`);
    });

    this.resolver.on('bridgeCompleted', (bridge) => {
      console.log(`✅ Bridge completed: ${bridge.id} (${bridge.type})`);
    });
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Bridge API...');
    
    // Initialize resolver
    await this.resolver.initialize();
    await this.resolver.start();
    
    // Start HTTP server
    this.server = this.app.listen(this.port, () => {
      console.log(`✅ Bridge API listening on port ${this.port}`);
      console.log(`📊 Health check: http://localhost:${this.port}/health`);
      console.log(`🌉 Bridges API: http://localhost:${this.port}/bridges`);
      console.log(`📡 Events stream: http://localhost:${this.port}/events`);
      const status = this.resolver.getStatus();
      if (status.tronEnabled) {
        console.log(`🔗 ETH ↔ TRON Resolver active`);
      }
    });
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Bridge API...');
    
    if (this.server) {
      this.server.close();
    }
    
    await this.resolver.stop();
    
    console.log('✅ Bridge API stopped');
  }
}