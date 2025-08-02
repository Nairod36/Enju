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

  // Helper function to safely serialize data with BigInt values
  private safeBigIntStringify(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
  }

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

    // Custom JSON serialization to handle BigInt values
    this.app.set('json replacer', (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });

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
        const safeBridges = this.safeBigIntStringify(bridges);
        res.json({
          success: true,
          data: safeBridges,
          count: safeBridges.length
        });
      } catch (error) {
        console.error('Error in /bridges endpoint:', error);
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
        const safeBridges = this.safeBigIntStringify(bridges);
        res.json({
          success: true,
          data: safeBridges,
          count: safeBridges.length
        });
      } catch (error) {
        console.error('Error in /bridges/active endpoint:', error);
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

        const safeBridge = this.safeBigIntStringify(bridge);
        res.json({
          success: true,
          data: safeBridge
        });
      } catch (error) {
        console.error('Error in /bridges/:bridgeId endpoint:', error);
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
        console.log('🚀 Bridge initiate request:', JSON.stringify(request, null, 2));

        // Basic validation
        if (!request.type || !request.amount || !request.hashlock || !request.timelock || !request.ethRecipient) {
          console.log('❌ Validation failed - missing basic fields:', {
            type: !!request.type,
            amount: !!request.amount,
            hashlock: !!request.hashlock,
            timelock: !!request.timelock,
            ethRecipient: !!request.ethRecipient
          });
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: type, amount, hashlock, timelock, ethRecipient'
          });
        }

        // Chain-specific validation
        if ((request.type === 'ETH_TO_NEAR' || request.type === 'NEAR_TO_ETH') && !request.nearAccount) {
          console.log('❌ Validation failed - NEAR bridges require nearAccount');
          return res.status(400).json({
            success: false,
            error: 'NEAR bridges require nearAccount field'
          });
        }

        if ((request.type === 'ETH_TO_TRON' || request.type === 'TRON_TO_ETH') && !request.tronAddress) {
          console.log('❌ Validation failed - TRON bridges require tronAddress');
          return res.status(400).json({
            success: false,
            error: 'TRON bridges require tronAddress field'
          });
        }

        console.log('✅ Validation passed, initiating bridge...');
        const bridgeId = await this.resolver.initiateBridge(request);
        console.log('✅ Bridge initiated successfully:', bridgeId);

        res.json({
          success: true,
          data: {
            bridgeId,
            message: 'Bridge initiated successfully'
          }
        });
      } catch (error) {
        console.error('❌ Bridge initiate error:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
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

    // Test endpoint for debugging
    this.app.post('/test-bridge', (req, res) => {
      console.log('🧪 Test bridge request:', JSON.stringify(req.body, null, 2));
      res.json({
        success: true,
        message: 'Test successful',
        received: req.body
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
        // Use SHA256 to match frontend (NEAR compatibility)
        const computedHashlock = ethers.sha256(secret);

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

    // ===== MINT ETH ENDPOINT (FOR TESTING ON FORK) =====

    // Mint ETH to address (for hackathon/testing purposes)
    this.app.post('/api/mint-eth', async (req, res) => {
      try {
        const { address } = req.body;
        const amount = '0.1'; // Fixed amount of 0.1 ETH

        if (!address) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: address'
          });
        }

        // Validate address format
        if (!address.startsWith('0x') || address.length !== 42) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Ethereum address format'
          });
        }

        console.log(`💰 Minting ${amount} ETH to ${address}...`);

        // Use the admin wallet to send ETH (from config)
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(this.config.ethRpcUrl);

        // Use admin private key from config or fallback to default Anvil key
        const adminPrivateKey = this.config.ethAdminPrivateKey ||
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

        const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

        // Check admin balance first
        const adminBalance = await provider.getBalance(adminWallet.address);
        const amountWei = ethers.parseEther(amount);

        if (adminBalance < amountWei) {
          return res.status(400).json({
            success: false,
            error: `Insufficient admin balance. Admin has ${ethers.formatEther(adminBalance)} ETH, needs ${amount} ETH`
          });
        }

        // Send ETH to the user
        const tx = await adminWallet.sendTransaction({
          to: address,
          value: amountWei,
          gasLimit: 21000
        });

        console.log(`📋 Mint transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();

        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }

        console.log(`✅ Successfully minted ${amount} ETH to ${address}`);
        console.log(`📋 Transaction confirmed in block ${receipt.blockNumber}`);

        res.json({
          success: true,
          data: {
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            amount: `${amount} ETH`,
            recipient: address,
            gasUsed: receipt.gasUsed.toString(),
            adminAddress: adminWallet.address
          },
          message: `Successfully minted ${amount} ETH to ${address}`
        });

      } catch (error) {
        console.error('❌ Mint ETH error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Mint failed'
        });
      }
    });

    // ===== WALLET INFO ENDPOINTS =====

    // Get ETH balance of an address
    this.app.get('/api/balance/:address', async (req, res) => {
      try {
        const { address } = req.params;

        if (!address.startsWith('0x') || address.length !== 42) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Ethereum address format'
          });
        }

        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(this.config.ethRpcUrl);

        const balance = await provider.getBalance(address);
        const balanceInEth = ethers.formatEther(balance);

        res.json({
          success: true,
          data: {
            address,
            balance: balanceInEth,
            balanceWei: balance.toString()
          }
        });

      } catch (error) {
        console.error('❌ Balance fetch error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch balance'
        });
      }
    });

    // Get transaction history for debugging (bridge transactions)
    this.app.get('/api/transactions/:address', async (req, res) => {
      try {
        const { address } = req.params;

        // Get bridge transactions involving this address
        const bridges = this.resolver.getAllBridges().filter(bridge =>
          bridge.ethRecipient === address ||
          bridge.nearAccount === address ||
          (bridge as any).user === address
        );

        // Sort by creation date (newest first)
        bridges.sort((a, b) => b.createdAt - a.createdAt);

        res.json({
          success: true,
          data: {
            address,
            transactionCount: bridges.length,
            transactions: bridges.map(bridge => ({
              id: bridge.id,
              type: bridge.type,
              status: bridge.status,
              amount: bridge.amount,
              ethTxHash: bridge.ethTxHash,
              nearTxHash: bridge.nearTxHash,
              contractId: bridge.contractId,
              escrowAddress: bridge.escrowAddress,
              createdAt: new Date(bridge.createdAt).toISOString(),
              completedAt: bridge.completedAt ? new Date(bridge.completedAt).toISOString() : null
            }))
          }
        });

      } catch (error) {
        console.error('❌ Transaction history error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch transaction history'
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
        const safeBridge = this.safeBigIntStringify(bridge);
        res.write(`data: ${JSON.stringify({ type: 'bridgeCreated', data: safeBridge })}\\n\\n`);
      };

      const onBridgeCompleted = (bridge: any) => {
        const safeBridge = this.safeBigIntStringify(bridge);
        res.write(`data: ${JSON.stringify({ type: 'bridgeCompleted', data: safeBridge })}\\n\\n`);
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