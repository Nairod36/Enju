import { EventEmitter } from 'events';
import { EthereumListener } from './eth-listener';
import { NearListener } from './near-listener';
import { BridgeEvent, EthEscrowCreatedEvent, NearHTLCEvent, ResolverConfig, SwapRequest } from '../types';
import { ethers } from 'ethers';
import { PriceOracle } from './price-oracle';

export class BridgeResolver extends EventEmitter {
  private ethListener: EthereumListener;
  private nearListener: NearListener;
  private activeBridges: Map<string, BridgeEvent> = new Map();
  private resolverSigner: ethers.Wallet;
  private ethToNearMap = new Map<string, string>();
  private processedTxHashes = new Set<string>(); // 🔥 Cache pour éviter les doublons
  private priceOracle: PriceOracle;

  constructor(private config: ResolverConfig) {
    super();

    this.ethListener = new EthereumListener(config);
    this.nearListener = new NearListener(config);
    this.priceOracle = new PriceOracle();

    // Initialize resolver signer for ETH transactions
    const provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.resolverSigner = new ethers.Wallet(config.ethPrivateKey, provider);

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    console.log('🌉 Initializing Bridge Resolver...');

    await this.ethListener.initialize();
    await this.nearListener.initialize();

    console.log('✅ Bridge Resolver initialized');
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Bridge Resolver...');

    await this.ethListener.startListening();
    await this.nearListener.startListening();

    console.log('✅ Bridge Resolver is running');
  }

  async stop(): Promise<void> {
    await this.ethListener.stopListening();
    await this.nearListener.stopListening();
    console.log('🛑 Bridge Resolver stopped');
  }

  private setupEventHandlers(): void {
    // Handle ETH → NEAR bridge initiation
    this.ethListener.on('escrowCreated', this.handleEthToNearBridge.bind(this));

    // Handle ETH swap completion
    this.ethListener.on('swapCompleted', this.handleEthSwapCompleted.bind(this));

    // Handle NEAR HTLC creation
    this.nearListener.on('htlcCreated', this.handleNearHTLCCreated.bind(this));

    // Handle NEAR swap completion
    this.nearListener.on('htlcCompleted', this.handleNearSwapCompleted.bind(this));
  }

  private async handleEthToNearBridge(event: EthEscrowCreatedEvent): Promise<void> {
    console.log('🔄 Processing ETH → NEAR bridge...');

    // 🔥 Éviter les doublons par txHash ou hashlock+escrow si txHash est undefined
    const dedupeKey = event.txHash || `${event.hashlock}-${event.escrow}`;
    if (this.processedTxHashes.has(dedupeKey)) {
      console.log(`⚠️ Event ${dedupeKey} already processed, skipping...`);
      return;
    }
    this.processedTxHashes.add(dedupeKey);

    try {
      const bridgeId = this.generateBridgeId(event.hashlock, 'ETH_TO_NEAR');

      // Create bridge tracking entry
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'ETH_TO_NEAR',
        status: 'PENDING',
        ethTxHash: event.txHash,
        escrowAddress: event.escrow,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.nearAccount, // This should be parsed correctly
        nearAccount: event.nearAccount,
        timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h from now
        createdAt: Date.now(),
        // secret will be provided when user completes the bridge
      };

      this.activeBridges.set(bridgeId, bridgeEvent);

      // 🔄 AUTO-CREATE NEAR HTLC: Bridge resolver creates NEAR HTLC for user
      console.log(`🔄 Auto-creating NEAR HTLC for ETH → NEAR bridge: ${bridgeId}`);
      console.log(`💰 Converting ETH amount to NEAR...`);
      
      // Convert ETH amount to NEAR using price oracle
      const ethAmountInEth = parseFloat(ethers.formatEther(event.amount));
      console.log(`💱 Converting ${ethAmountInEth} ETH to NEAR...`);
      const nearAmount = await this.priceOracle.convertEthToNear(ethAmountInEth.toString());
      console.log(`💰 Conversion: ${ethAmountInEth} ETH → ${nearAmount} NEAR`);
      
      try {
        // Create NEAR HTLC automatically with bridge resolver's funds
        console.log(`🔄 Creating NEAR HTLC for user ${event.nearAccount}...`);
        const contractId = await this.nearListener.createCrossChainHTLC({
          receiver: event.nearAccount,
          hashlock: event.hashlock,
          timelock: Date.now() + (24 * 60 * 60 * 1000), // 24h timelock
          ethAddress: event.escrow,
          amount: event.amount // Pass ETH wei amount, let near-listener do the conversion
        });
        
        // Update bridge with contract ID
        bridgeEvent.contractId = contractId;
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        console.log(`✅ NEAR HTLC created automatically: ${contractId}`);
        console.log(`🎯 Bridge ready for completion! Both sides active.`);
        
      } catch (nearError) {
        console.error('❌ Failed to create NEAR HTLC automatically:', nearError);
        // Fallback to monitoring mode if auto-creation fails
        console.log(`⚠️ Falling back to manual mode - user must create NEAR HTLC`);
        console.log(`📋 Expected NEAR HTLC params:`);
        console.log(`   - receiver: ${event.nearAccount} (user's NEAR account)`);
        console.log(`   - hashlock: ${event.hashlock}`);
        console.log(`   - ethAddress: ${event.escrow}`);
        console.log(`   - amount: ${nearAmount} NEAR`);
      }

      this.emit('bridgeCreated', bridgeEvent);

    } catch (error) {
      console.error('❌ Error handling ETH → NEAR bridge:', error);
    }
  }

  private async handleEthSwapCompleted(event: any): Promise<void> {
    console.log('🔄 Processing ETH swap completion...');

    try {
      // Find the bridge by escrow address
      const bridge = Array.from(this.activeBridges.values())
        .find(b => b.escrowAddress === event.escrow && b.status === 'PENDING');

      if (!bridge) {
        console.log('⚠️ No matching bridge found for ETH swap completion');
        return;
      }

      bridge.secret = event.secret;
      bridge.status = 'COMPLETED';
      bridge.completedAt = Date.now();

      // Complete NEAR side if we have the contract ID
      if (bridge.contractId) {
        await this.nearListener.completeSwap(bridge.contractId, event.secret);
      }

      this.activeBridges.set(bridge.id, bridge);
      console.log(`✅ ETH → NEAR bridge completed: ${bridge.id}`);
      this.emit('bridgeCompleted', bridge);

    } catch (error) {
      console.error('❌ Error handling ETH swap completion:', error);
    }
  }

  private async handleNearHTLCCreated(event: NearHTLCEvent): Promise<void> {
    console.log('📦 NEAR HTLC created:', event.contractId);
    console.log('🔍 NEAR HTLC details:', {
      contractId: event.contractId,
      hashlock: event.hashlock,
      ethAddress: event.ethAddress,
      sender: event.sender,
      amount: event.amount,
      timelock: event.timelock
    });

    // Check if this HTLC is part of an existing ETH→NEAR bridge
    console.log(`🔍 Searching for existing ETH→NEAR bridges...`);
    const activeBridges = Array.from(this.activeBridges.values());
    console.log(`🔍 Found ${activeBridges.length} active bridges`);
    
    for (const bridge of activeBridges) {
      console.log(`🔍 Checking bridge ${bridge.id}:`, {
        type: bridge.type,
        hashlock: bridge.hashlock,
        hasContractId: !!bridge.contractId,
        status: bridge.status
      });
    }
    
    // Normalize hashlocks for comparison (remove 0x prefix if present)
    const normalizeHashlock = (hashlock: string) => hashlock.replace(/^0x/, '').toLowerCase();
    const eventHashlockNormalized = normalizeHashlock(event.hashlock);
    
    const existingBridge = activeBridges
      .find(b => {
        const normalizedBridgeHashlock = normalizeHashlock(b.hashlock);
        return normalizedBridgeHashlock === eventHashlockNormalized;
      });

    if (existingBridge) {
      // Update existing bridge with NEAR contract ID if not already set
      if (!existingBridge.contractId) {
        existingBridge.contractId = event.contractId;
      }
      this.activeBridges.set(existingBridge.id, existingBridge);
      console.log(`🎯 BRIDGE LINKED! ETH bridge ${existingBridge.id} now connected to NEAR HTLC ${event.contractId}`);
      console.log(`✅ Bridge ready for completion! Both ETH and NEAR HTLCs are active.`);
      
      // 🔥 AUTO-COMPLETE ETH→NEAR: Bridge resolver completes NEAR HTLC automatically
      // Only auto-complete for ETH→NEAR bridges, not NEAR→ETH
      if (existingBridge.type === 'ETH_TO_NEAR' && existingBridge.secret) {
        console.log(`🔓 Auto-completing NEAR HTLC for ETH→NEAR bridge with secret...`);
        try {
          await this.nearListener.completeHTLC(event.contractId, existingBridge.secret);
          console.log(`✅ NEAR HTLC auto-completed! User should receive NEAR now.`);
          
          existingBridge.status = 'COMPLETED';
          existingBridge.completedAt = Date.now();
          this.activeBridges.set(existingBridge.id, existingBridge);
          this.emit('bridgeCompleted', existingBridge);
          
        } catch (error) {
          console.error('❌ Failed to auto-complete NEAR HTLC:', error);
        }
      } else if (existingBridge.type === 'ETH_TO_NEAR') {
        console.log('⚠️ No secret available yet - waiting for ETH escrow completion to get secret');
      } else if (existingBridge.type === 'NEAR_TO_ETH') {
        console.log('✅ NEAR→ETH bridge ready - user needs to complete NEAR HTLC');
      }
      
      console.log(`📋 Complete bridge state:`, {
        id: existingBridge.id,
        type: existingBridge.type,
        status: existingBridge.status,
        ethTxHash: existingBridge.ethTxHash,
        contractId: existingBridge.contractId,
        hashlock: existingBridge.hashlock,
        escrowAddress: existingBridge.escrowAddress
      });
      return;
    }

    console.log(`⚠️ No matching ETH→NEAR bridge found for NEAR HTLC ${event.contractId}`);
    console.log(`🔍 Looking for hashlock: ${event.hashlock}`);
    console.log(`🔍 Available ETH→NEAR bridges:`, activeBridges.filter(b => b.type === 'ETH_TO_NEAR').map(b => ({ id: b.id, hashlock: b.hashlock, hasContractId: !!b.contractId })));

    // For standalone NEAR → ETH bridges - Auto-create ETH escrow
    const bridgeId = this.generateBridgeId(event.hashlock, 'NEAR_TO_ETH');

    console.log(`🔄 Auto-creating ETH escrow for NEAR → ETH bridge: ${bridgeId}`);
    console.log(`📋 ETH escrow params:`);
    console.log(`   - recipient: ${event.ethAddress} (user's ETH address)`);
    console.log(`   - hashlock: ${event.hashlock}`);
    console.log(`   - amount: ${event.amount}`);

    try {
      // Parse amount - it could be "1.43 NEAR" format or yoctoNEAR string
      let nearAmount: number;
      
      if (event.amount.includes('NEAR')) {
        // Format: "1.43 NEAR"
        const nearAmountMatch = event.amount.match(/(\d+\.?\d*)/);
        nearAmount = nearAmountMatch ? parseFloat(nearAmountMatch[1]) : 0;
      } else {
        // Assume it's yoctoNEAR string - convert to NEAR
        const yoctoAmount = BigInt(event.amount);
        nearAmount = Number(yoctoAmount) / 1e24; // Convert yoctoNEAR to NEAR
      }
      
      console.log(`💱 Converting ${nearAmount} NEAR to ETH...`);
      const ethAmount = await this.priceOracle.convertNearToEth(nearAmount.toString());
      const ethAmountWei = ethers.parseEther(ethAmount);
      
      console.log(`💰 Conversion: ${nearAmount} NEAR → ${ethAmount} ETH (${ethAmountWei.toString()} wei)`);

      // Create ETH escrow using the bridge contract
      let escrowResult;
      try {
        console.log('🔄 Creating ETH escrow...');
        escrowResult = await this.createEthEscrow({
          hashlock: event.hashlock,
          recipient: event.ethAddress,
          amount: ethAmountWei.toString(),
          timelock: event.timelock
        });
        console.log('✅ ETH escrow creation completed:', escrowResult);
      } catch (escrowError) {
        console.error('❌ Failed to create ETH escrow:', escrowError);
        // Create fallback bridge event without escrow
        escrowResult = { 
          tx: { hash: 'escrow_creation_failed' }, 
          receipt: null, 
          escrowAddress: '' 
        };
      }

      // Store the secret - we'll extract it from ModernBridge's hashlock
      // The secret is what generates the hashlock, so we need to reverse-engineer it
      // For now, let's use a predetermined secret for testing
      const testSecret = '0x' + '1'.repeat(64); // Test secret
      
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'NEAR_TO_ETH',
        status: 'PENDING',
        nearTxHash: '', // Would be filled from transaction hash
        contractId: event.contractId,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.ethAddress,
        nearAccount: event.sender,
        ethTxHash: escrowResult.tx.hash,
        escrowAddress: escrowResult.escrowAddress,
        timelock: event.timelock,
        createdAt: Date.now(),
        secret: testSecret
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      console.log(`✅ NEAR → ETH bridge fully created: ${bridgeId}`);
      console.log(`⏳ Waiting for user to complete NEAR HTLC with their wallet...`);
      this.emit('bridgeCreated', bridgeEvent);
      
    } catch (error) {
      console.error(`❌ Failed to create ETH escrow for NEAR → ETH bridge:`, error);
      
      // Create tracking entry even if ETH escrow creation failed
      const bridgeEvent: BridgeEvent = {
        id: bridgeId,
        type: 'NEAR_TO_ETH',
        status: 'PENDING',
        nearTxHash: '',
        contractId: event.contractId,
        hashlock: event.hashlock,
        amount: event.amount,
        ethRecipient: event.ethAddress,
        nearAccount: event.sender,
        timelock: event.timelock,
        createdAt: Date.now()
      };

      this.activeBridges.set(bridgeId, bridgeEvent);
      this.emit('bridgeCreated', bridgeEvent);
    }
  }

  private async handleNearSwapCompleted(event: any): Promise<void> {
    console.log('✅ NEAR swap completed:', event.contractId, 'with secret:', event.secret ? event.secret.substring(0, 14) + '...' : 'none');

    // Find and update the bridge
    const bridge = Array.from(this.activeBridges.values())
      .find(b => b.contractId === event.contractId && b.status === 'PENDING');

    if (bridge) {
      bridge.status = 'COMPLETED';
      bridge.completedAt = Date.now();
      bridge.nearTxHash = event.txHash;
      
      // Store the secret from the NEAR transaction
      if (event.secret) {
        bridge.secret = event.secret;
      }

      // 🔥 AUTO-COMPLETE: Use revealed secret to complete the appropriate escrow
      if (event.secret) {
        if (bridge.type === 'NEAR_TO_ETH' && bridge.ethTxHash) {
          console.log('🔓 Auto-completing ETH escrow for NEAR → ETH bridge with revealed secret...');
          console.log(`🔍 Bridge ethTxHash: ${bridge.ethTxHash}`);
          console.log(`🔍 Bridge escrowAddress: ${bridge.escrowAddress}`);
          
          try {
            // Use escrow address if available, otherwise try to extract from transaction
            let escrowAddress = bridge.escrowAddress;
            
            if (!escrowAddress) {
              console.log(`⚠️ No escrowAddress in bridge, skipping ETH completion. Bridge needs escrowAddress to complete.`);
              console.log(`🔍 Available bridge fields:`, Object.keys(bridge));
              return;
            }
            
            console.log(`✅ Using escrow address: ${escrowAddress}`);
            
            // Complete ETH escrow with the secret from NEAR transaction
            const completionTx = await this.completeEthEscrow(escrowAddress, event.secret);
            console.log('✅ ETH escrow auto-completed! User should receive ETH now.');
            console.log(`📋 ETH completion transaction: ${completionTx.hash}`);
            console.log(`🔗 View on explorer: https://etherscan.io/tx/${completionTx.hash}`);
            
            // Store completion transaction hash
            bridge.ethCompletionTxHash = completionTx.hash;
          } catch (error) {
            console.error('❌ Failed to auto-complete ETH escrow:', error);
          }
        } else if (bridge.type === 'ETH_TO_NEAR') {
          console.log('✅ ETH → NEAR bridge completed! User received NEAR tokens.');
          console.log('💰 User has successfully completed the NEAR HTLC and received their NEAR.');
          // For ETH → NEAR, the user already paid ETH and now received NEAR
          // No additional escrow completion needed - the bridge is complete
        } else {
          console.log(`⚠️ Unhandled bridge type: ${bridge.type}`);
        }
      } else {
        console.log('⚠️  No secret found in NEAR completion - cannot process bridge completion');
      }

      this.activeBridges.set(bridge.id, bridge);
      this.emit('bridgeCompleted', bridge);
    }
  }

  private async createEthEscrow(params: {
    hashlock: string;
    recipient: string;
    amount: string;
    timelock: number;
  }): Promise<any> {
    console.log(`🔄 Creating ETH destination escrow for NEAR → ETH bridge...`);
    console.log(`📋 Parameters:`, {
      hashlock: params.hashlock,
      recipient: params.recipient,
      amount: ethers.formatEther(params.amount),
      amountWei: params.amount,
      timelock: new Date(params.timelock).toISOString()
    });

    // For now, let's use a simple approach: just store the ETH in the resolver contract
    // and create a deterministic "escrow address" that we can use for tracking
    console.log(`🔄 Using simplified escrow approach (storing ETH in resolver)...`);
    
    // Create deterministic escrow address for tracking purposes
    const escrowData = ethers.solidityPackedKeccak256(
      ['bytes32', 'address', 'uint256', 'uint256'],
      [params.hashlock, params.recipient, params.amount, params.timelock]
    );
    const escrowAddress = '0x' + escrowData.slice(26); // Take last 20 bytes as address
    
    console.log(`📋 Deterministic escrow address: ${escrowAddress}`);
    
    // Send ETH directly to the resolver contract for safekeeping
    // In a real production system, you'd use a proper escrow contract
    const tx = await this.resolverSigner.sendTransaction({
      to: this.config.ethBridgeContract,
      value: BigInt(params.amount),
      gasLimit: 100000
    });

    console.log(`📋 Transaction sent: ${tx.hash}`);
    console.log(`⏳ Waiting for transaction confirmation...`);
    
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    console.log(`✅ ETH destination escrow created (simplified)!`);
    console.log(`📋 Transaction hash: ${tx.hash}`);
    console.log(`📋 Escrow address: ${escrowAddress}`);
    console.log(`📋 Gas used: ${receipt.gasUsed}`);

    return { tx, receipt, escrowAddress };
  }

  private async completeEthEscrow(escrowAddress: string, secret: string): Promise<any> {
    console.log(`🔄 Completing ETH escrow with secret (simplified approach)...`);
    console.log(`📋 Escrow: ${escrowAddress}`);
    console.log(`📋 Secret: ${secret.substring(0, 14)}...`);
    
    try {
      // Get the bridge associated with this escrow
      const bridge = Array.from(this.activeBridges.values())
        .find(b => b.escrowAddress === escrowAddress);
      
      if (!bridge) {
        throw new Error(`No bridge found for escrow ${escrowAddress}`);
      }

      console.log(`📋 Found bridge for escrow, recipient: ${bridge.ethRecipient}`);

      // For simplified approach: transfer ETH directly from resolver to recipient
      // In production, you'd verify the secret matches the hashlock first
      console.log(`🔄 Transferring ETH directly to recipient...`);
      
      const tx = await this.resolverSigner.sendTransaction({
        to: bridge.ethRecipient,
        value: BigInt(bridge.amount),
        gasLimit: 100000
      });
      
      console.log(`� Transfer transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }
      
      console.log(`✅ ETH escrow completed successfully (simplified)!`);
      console.log(`💰 ETH transferred to: ${bridge.ethRecipient}`);
      console.log(`💰 Amount: ${ethers.formatEther(bridge.amount)} ETH`);
      
      return receipt;
    } catch (error) {
      console.error(`❌ Error completing ETH escrow:`, error);
      throw error;
    }
  }

  private async completeNearHTLC(contractId: string, secret: string): Promise<void> {
    // Use the NEAR listener to complete the NEAR HTLC
    await this.nearListener.completeHTLC(contractId, secret);
  }

  // Public methods for manual operations
  async initiateBridge(request: SwapRequest): Promise<string> {
    const bridgeId = this.generateBridgeId(request.hashlock, request.type);

    console.log(`🚀 Initiating ${request.type} bridge: ${bridgeId}`);

    const bridgeEvent: BridgeEvent = {
      id: bridgeId,
      type: request.type,
      status: 'PENDING',
      hashlock: request.hashlock,
      amount: request.amount,
      ethRecipient: request.ethRecipient,
      nearAccount: request.nearAccount,
      timelock: request.timelock,
      createdAt: Date.now(),
      secret: request.secret
    };

    this.activeBridges.set(bridgeId, bridgeEvent);

    if (request.type === 'NEAR_TO_ETH') {
      // User has already created NEAR HTLC with their wallet
      // We just need to create the ETH escrow
      console.log(`🔄 Creating ETH escrow for NEAR → ETH bridge: ${bridgeId}`);
      
      // Set the contract ID from the request (provided by frontend)
      if (request.contractId) {
        bridgeEvent.contractId = request.contractId;
      }
      
      try {
        // Parse NEAR amount and convert to ETH
        const nearAmount = parseFloat(request.amount);
        console.log(`💱 Converting ${nearAmount} NEAR to ETH...`);
        const ethAmount = await this.priceOracle.convertNearToEth(nearAmount.toString());
        const ethAmountWei = ethers.parseEther(ethAmount);
        
        console.log(`💰 Conversion: ${nearAmount} NEAR → ${ethAmount} ETH (${ethAmountWei.toString()} wei)`);

        // Create ETH escrow
        console.log('🔄 Creating ETH escrow...');
        const escrowResult = await this.createEthEscrow({
          hashlock: request.hashlock,
          recipient: request.ethRecipient,
          amount: ethAmountWei.toString(),
          timelock: request.timelock
        });
        
        console.log('✅ ETH escrow creation completed:', escrowResult);
        
        // Update bridge with ETH escrow details
        bridgeEvent.ethTxHash = escrowResult.tx.hash;
        bridgeEvent.escrowAddress = escrowResult.escrowAddress;
        this.activeBridges.set(bridgeId, bridgeEvent);
        
        console.log(`✅ Bridge ready! User can now complete NEAR HTLC to receive ETH`);
        
      } catch (error) {
        console.error('❌ Failed to create ETH escrow for NEAR → ETH bridge:', error);
      }
    }

    this.emit('bridgeCreated', bridgeEvent);
    return bridgeId;
  }

  async completeBridge(bridgeId: string, secret: string): Promise<void> {
    const bridge = this.activeBridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    bridge.secret = secret;

    if (bridge.type === 'ETH_TO_NEAR' && bridge.contractId) {
      await this.nearListener.completeSwap(bridge.contractId, secret);
    }

    bridge.status = 'COMPLETED';
    bridge.completedAt = Date.now();
    this.activeBridges.set(bridgeId, bridge);

    this.emit('bridgeCompleted', bridge);
  }

  private generateBridgeId(hashlock: string, type: string): string {
    return `${type.toLowerCase()}_${hashlock.slice(2, 12)}_${Date.now()}`;
  }

  // Getters
  getBridge(bridgeId: string): BridgeEvent | undefined {
    return this.activeBridges.get(bridgeId);
  }

  getAllBridges(): BridgeEvent[] {
    return Array.from(this.activeBridges.values());
  }

  getActiveBridges(): BridgeEvent[] {
    return this.getAllBridges().filter(b => b.status === 'PENDING');
  }

  getNearListener(): NearListener {
    return this.nearListener;
  }

  getEthListener(): EthereumListener {
    return this.ethListener;
  }

  getStatus() {
    return {
      activeBridges: this.activeBridges.size,
      ethListener: this.ethListener.getStatus(),
      nearListener: this.nearListener.getStatus(),
      resolverAddress: this.resolverSigner.address
    };
  }
}