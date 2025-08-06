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
    // Configuration CORS pour VPS
    this.app.use(cors({
      origin: [
        'http://localhost:5173',
        'http://152.228.163.97:5173',
        'http://152.228.163.97:3001',
        'http://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    }));
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

    // ===== REWARD SYSTEM ENDPOINTS =====

    // Get reward token balance for an address
    this.app.get('/rewards/balance', async (req, res) => {
      try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Missing or invalid address parameter'
          });
        }

        // For now, return a simple balance structure
        // TODO: Integrate with actual reward token contract
        const balance = await this.resolver.getRewardTokenBalance(address);

        res.json({
          success: true,
          balance: balance || '0',
          address
        });
      } catch (error) {
        console.error('❌ Reward balance error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch reward balance'
        });
      }
    });

    // Get reward stats for an address (total earned, bridge count)
    this.app.get('/rewards/stats', (req, res) => {
      try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Missing or invalid address parameter'
          });
        }

        // Get all bridges completed by this address
        const allBridges = this.resolver.getAllBridges();
        const userBridges = allBridges.filter(bridge => {
          // More precise matching based on bridge type and user role
          switch (bridge.type) {
            case 'ETH_TO_NEAR':
              // User is ETH sender, recipient gets NEAR
              return (
                bridge.ethRecipient === address ||
                (bridge as any).from === address ||
                (bridge as any).sender === address
              );
            case 'NEAR_TO_ETH':
              // User is NEAR sender, recipient gets ETH  
              return (
                bridge.nearAccount === address ||
                bridge.ethRecipient === address
              );
            case 'ETH_TO_TRON':
              // User is ETH sender, recipient gets TRX
              return (
                bridge.ethRecipient === address ||
                bridge.tronAddress === address ||
                (bridge as any).from === address ||
                (bridge as any).sender === address
              );
            case 'TRON_TO_ETH':
              // User is TRON sender, recipient gets ETH
              return (
                bridge.tronSender === address ||
                bridge.tronAddress === address ||
                bridge.ethRecipient === address
              );
            default:
              // Fallback to original logic
              return (
                bridge.ethRecipient === address ||
                bridge.nearAccount === address ||
                bridge.tronAddress === address ||
                bridge.tronSender === address ||
                (bridge as any).from === address ||
                (bridge as any).sender === address
              );
          }
        });

        // Count completed bridges by type
        const completedBridges = userBridges.filter(bridge => bridge.status === 'COMPLETED');
        const bridgeCount = completedBridges.length;

        // Calculate total rewards earned based on bridge volume
        let totalRewardsEarned = 0;
        completedBridges.forEach(bridge => {
          try {
            const amount = parseFloat(bridge.amount);
            if (bridge.type === 'ETH_TO_NEAR' || bridge.type === 'ETH_TO_TRON') {
              // ETH bridges: 100 REWARD per ETH
              totalRewardsEarned += amount * 100;
            } else if (bridge.type === 'NEAR_TO_ETH') {
              // NEAR bridges: 0.068 REWARD per NEAR 
              totalRewardsEarned += amount * 0.068;
            } else if (bridge.type === 'TRON_TO_ETH') {
              // TRON bridges: 0.00394 REWARD per TRX
              totalRewardsEarned += amount * 0.00394;
            }
          } catch (error) {
            console.warn('Failed to parse bridge amount:', bridge.amount);
          }
        });

        // Bridge count by type for detailed stats
        const bridgeStats = {
          ETH_TO_NEAR: completedBridges.filter(b => b.type === 'ETH_TO_NEAR').length,
          NEAR_TO_ETH: completedBridges.filter(b => b.type === 'NEAR_TO_ETH').length,
          ETH_TO_TRON: completedBridges.filter(b => b.type === 'ETH_TO_TRON').length,
          TRON_TO_ETH: completedBridges.filter(b => b.type === 'TRON_TO_ETH').length
        };

        console.log(`📊 Reward stats for ${address}:`, {
          bridgeCount,
          totalRewardsEarned: totalRewardsEarned.toFixed(4),
          bridgeStats
        });

        res.json({
          success: true,
          bridgeCount,
          totalRewardsEarned: parseFloat(totalRewardsEarned.toFixed(4)),
          bridgeStats,
          address
        });
      } catch (error) {
        console.error('❌ Reward stats error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch reward stats'
        });
      }
    });

    // ===== API V1 ROUTES =====

    // API v1 - Get all bridges
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
        console.error('Error in /api/v1/bridges endpoint:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });


    // API v1 - SSE Events endpoint
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
        console.log('📡 API v1 SSE: Preparing to send bridgeCreated event:', {
          bridgeId: bridge.id,
          bridgeType: bridge.type,
          hashlock: bridge.hashlock ? bridge.hashlock.substring(0, 20) + '...' : null,
          ethTxHash: bridge.ethTxHash ? bridge.ethTxHash.substring(0, 20) + '...' : null,
          status: bridge.status
        });

        const eventData = { type: 'bridgeCreated', data: safeBridge };
        const eventString = `data: ${JSON.stringify(eventData)}\\n\\n`;

        console.log('📡 API v1 SSE: Writing event to stream (length:', eventString.length, 'chars)');
        res.write(eventString);
        console.log('📡 API v1 SSE: Event written successfully');
      };

      const onBridgeCompleted = (bridge: any) => {
        const safeBridge = this.safeBigIntStringify(bridge);
        console.log('📡 API v1 SSE: Sending bridgeCompleted event for bridge:', bridge.id, 'type:', bridge.type);
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
      console.log(`🌉 Bridges API v1: http://localhost:${this.port}/api/v1/bridges`);
      console.log(`📡 Events stream: http://localhost:${this.port}/events`);
      console.log(`📡 Events stream v1: http://localhost:${this.port}/api/v1/events`);
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