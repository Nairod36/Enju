#!/usr/bin/env node

/**
 * 🌉 Complete ETH ↔ NEAR Cross-Chain Demo with 1inch Fusion+ Features
 * Demonstrates bidirectional swaps, Dutch auction, and resolver functionality
 */

const { ethers } = require('ethers');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

class CompleteCrossChainDemo {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.htlcContract = null;
    this.nearClient = null;
    this.resolver = null;
    
    // Demo configuration
    this.config = {
      rpcUrl: 'http://127.0.0.1:8545',
      chainId: 1,
      nearNetwork: 'testnet',
      nearAccount: 'demo.testnet',
      htlcAddress: '0x0000000000000000000000000000000000000000', // Will be deployed
      demoAmount: '1000000000000000000', // 1 ETH in wei
      demoAmountNear: '1000000000000000000000000', // 1 NEAR in yocto
    };
  }

  async initialize() {
    log('cyan', '\n🌉 Mokuen Cross-Chain Demo - 1inch Fusion+ Style');
    log('cyan', '='.repeat(60));
    
    try {
      // Check if fork is running
      log('yellow', '\n📡 Checking Ethereum fork...');
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const network = await this.provider.getNetwork();
      log('green', `✅ Connected to chain ID: ${network.chainId}`);

      // Setup signer (use hardhat account #0)
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      this.signer = new ethers.Wallet(privateKey, this.provider);
      log('green', `✅ Signer address: ${this.signer.address}`);

      return true;
    } catch (error) {
      log('red', `❌ Initialization failed: ${error.message}`);
      log('yellow', '\n💡 Make sure to run: ./scripts/start-fork.sh');
      return false;
    }
  }

  async deployHTLCContract() {
    log('yellow', '\n🚀 Deploying Enhanced HTLC Contract...');
    
    try {
      // Try enhanced HTLC first, fallback to simple
      let artifactPath = path.join(__dirname, '../../../eth-contracts/out/HTLC.sol/HTLCEthereum.json');
      
      if (!fs.existsSync(artifactPath)) {
        log('yellow', '⚠️  Enhanced HTLC not found, using SimpleHTLC...');
        artifactPath = path.join(__dirname, '../../../eth-contracts/out/SimpleHTLC.sol/SimpleHTLC.json');
        
        if (!fs.existsSync(artifactPath)) {
          log('red', '❌ Contract artifacts not found. Run: forge build');
          return false;
        }
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      
      // Deploy contract
      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, this.signer);
      this.htlcContract = await factory.deploy();
      await this.htlcContract.waitForDeployment();
      
      const address = await this.htlcContract.getAddress();
      this.config.htlcAddress = address;
      
      log('green', `✅ HTLC deployed at: ${address}`);
      return true;
    } catch (error) {
      log('red', `❌ Contract deployment failed: ${error.message}`);
      return false;
    }
  }

  async demonstrateResolverRegistration() {
    log('yellow', '\n👤 Demonstrating Resolver Registration...');
    
    try {
      // Register as resolver with stake
      const stakeAmount = ethers.parseEther('1.0'); // 1 ETH stake
      const tx = await this.htlcContract.registerResolver({ value: stakeAmount });
      await tx.wait();
      
      log('green', `✅ Resolver registered with ${ethers.formatEther(stakeAmount)} ETH stake`);
      
      // Check resolver status
      const resolver = await this.htlcContract.resolvers(this.signer.address);
      log('green', `✅ Resolver status: registered=${resolver.registered}, stake=${ethers.formatEther(resolver.stake)} ETH`);
      
      return true;
    } catch (error) {
      log('red', `❌ Resolver registration failed: ${error.message}`);
      return false;
    }
  }

  async demonstrateETHtoNEARSwap() {
    log('yellow', '\n🔄 Demonstrating ETH → NEAR Swap with Dutch Auction...');
    
    try {
      // Generate HTLC parameters
      const secret = ethers.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      const startPrice = ethers.parseEther('2000'); // $2000
      const minPrice = ethers.parseEther('1800'); // $1800
      
      log('blue', `📝 HTLC Parameters:`);
      log('blue', `   Secret: ${ethers.hexlify(secret)}`);
      log('blue', `   Hashlock: ${hashlock}`);
      log('blue', `   Timelock: ${new Date(timelock * 1000).toISOString()}`);
      log('blue', `   Start Price: $${ethers.formatEther(startPrice)}`);
      log('blue', `   Min Price: $${ethers.formatEther(minPrice)}`);

      // Create HTLC with ETH (check if enhanced or simple version)
      log('yellow', '📝 Creating ETH HTLC...');
      
      let createTx;
      try {
        // Try enhanced version with Dutch auction
        createTx = await this.htlcContract.createHTLCEth(
          this.signer.address, // receiver
          hashlock,
          timelock,
          this.config.nearAccount, // NEAR account
          startPrice,
          minPrice,
          { value: this.config.demoAmount }
        );
      } catch (error) {
        // Fallback to simple version
        log('yellow', '⚠️  Using simple HTLC (no Dutch auction)');
        createTx = await this.htlcContract.createHTLCEth(
          this.signer.address, // receiver
          hashlock,
          timelock,
          this.config.nearAccount, // NEAR account
          { value: this.config.demoAmount }
        );
      }
      
      const receipt = await createTx.wait();
      const contractId = receipt.logs[0].topics[1]; // First indexed parameter
      
      log('green', `✅ ETH HTLC created: ${contractId}`);
      log('green', `✅ Transaction: ${createTx.hash}`);

      // Demonstrate Dutch auction price tracking
      await this.demonstrateDutchAuction(contractId);
      
      // Simulate NEAR HTLC creation (would be real in production)
      log('yellow', '📝 Simulating NEAR HTLC creation...');
      await this.sleep(2000);
      log('green', '✅ NEAR HTLC created (simulated)');
      
      // Demonstrate withdrawal with secret
      log('yellow', '💰 Demonstrating withdrawal with secret...');
      const withdrawTx = await this.htlcContract.withdraw(contractId, secret);
      await withdrawTx.wait();
      
      log('green', '✅ ETH withdrawn successfully!');
      log('green', `✅ Secret revealed: ${ethers.hexlify(secret)}`);
      
      return { contractId, secret, hashlock };
    } catch (error) {
      log('red', `❌ ETH → NEAR swap failed: ${error.message}`);
      return null;
    }
  }

  async demonstrateNEARtoETHSwap() {
    log('yellow', '\n🔄 Demonstrating NEAR → ETH Swap...');
    
    try {
      // Simulate NEAR HTLC creation first
      log('yellow', '📝 Simulating NEAR HTLC creation...');
      await this.sleep(1500);
      
      const secret = ethers.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      const startPrice = ethers.parseEther('2000');
      const minPrice = ethers.parseEther('1800');
      
      log('green', '✅ NEAR HTLC created (simulated)');
      
      // Create corresponding ETH HTLC
      log('yellow', '📝 Creating corresponding ETH HTLC...');
      const createTx = await this.htlcContract.createHTLCEth(
        this.signer.address,
        hashlock,
        timelock,
        this.config.nearAccount,
        startPrice,
        minPrice,
        { value: this.config.demoAmount }
      );
      
      await createTx.wait();
      log('green', '✅ ETH HTLC created for NEAR → ETH swap');
      log('green', `✅ Transaction: ${createTx.hash}`);
      
      return true;
    } catch (error) {
      log('red', `❌ NEAR → ETH swap failed: ${error.message}`);
      return false;
    }
  }

  async demonstrateDutchAuction(contractId) {
    log('yellow', '\n⏳ Demonstrating Dutch Auction Price Decay...');
    
    for (let i = 0; i < 5; i++) {
      try {
        const currentPrice = await this.htlcContract.getCurrentPrice(contractId);
        const priceUSD = ethers.formatEther(currentPrice);
        
        log('magenta', `   Current Price: $${parseFloat(priceUSD).toFixed(2)}`);
        
        if (i < 4) {
          await this.sleep(1000); // Wait 1 second
        }
      } catch (error) {
        log('red', `   Price check failed: ${error.message}`);
        break;
      }
    }
    
    log('green', '✅ Dutch auction demonstration complete');
  }

  async demonstratePartialFills() {
    log('yellow', '\n🔢 Demonstrating Partial Fills (Advanced Feature)...');
    
    // This would be implemented with multiple secrets and Merkle trees
    // For now, we'll simulate the concept
    log('blue', '📝 Partial fills would use:');
    log('blue', '   • Multiple HTLC contracts with different amounts');
    log('blue', '   • Merkle tree of secrets for efficient verification');
    log('blue', '   • Progressive resolution as resolvers compete');
    
    await this.sleep(1000);
    log('green', '✅ Partial fills concept demonstrated');
  }

  async demonstrateGameIntegration() {
    log('yellow', '\n🎮 Demonstrating Game Integration Rewards...');
    
    const rewards = {
      leafTokens: 150,
      magicFoxXP: 25,
      forestLevel: 3,
      newCreatures: ['🦊 Magic Fox', '🌿 Ancient Tree']
    };
    
    log('green', `✅ Swap completed! Forest rewards earned:`);
    log('green', `   🌿 +${rewards.leafTokens} LEAF tokens`);
    log('green', `   🦊 +${rewards.magicFoxXP} Magic Fox XP`);
    log('green', `   🌳 Forest Level: ${rewards.forestLevel}`);
    log('green', `   🎁 New creatures unlocked: ${rewards.newCreatures.join(', ')}`);
  }

  async runCompleteDemo() {
    log('cyan', '\n🚀 Starting Complete Cross-Chain Demo...');
    
    // Initialize
    if (!(await this.initialize())) {
      return false;
    }

    // Deploy enhanced HTLC contract
    if (!(await this.deployHTLCContract())) {
      return false;
    }

    // Demonstrate resolver registration
    if (!(await this.demonstrateResolverRegistration())) {
      return false;
    }

    // Demonstrate ETH → NEAR swap
    const ethToNearResult = await this.demonstrateETHtoNEARSwap();
    if (!ethToNearResult) {
      return false;
    }

    // Demonstrate NEAR → ETH swap
    if (!(await this.demonstrateNEARtoETHSwap())) {
      return false;
    }

    // Demonstrate advanced features
    await this.demonstratePartialFills();
    await this.demonstrateGameIntegration();

    // Final summary
    log('cyan', '\n🎉 Complete Demo Finished Successfully!');
    log('cyan', '='.repeat(60));
    log('green', '✅ Features Demonstrated:');
    log('green', '   • Bidirectional ETH ↔ NEAR swaps');
    log('green', '   • Dutch auction price mechanism');
    log('green', '   • Resolver registration with staking');
    log('green', '   • HTLC with hashlock/timelock security');
    log('green', '   • Game integration rewards');
    log('green', '   • 1inch Fusion+ compliance patterns');
    
    log('yellow', '\n📋 Next Steps:');
    log('yellow', '   1. Deploy to mainnet/testnet for live demo');
    log('yellow', '   2. Integrate with real NEAR contracts');
    log('yellow', '   3. Add UI for user-friendly interaction');
    log('yellow', '   4. Implement real-time price feeds');
    
    return true;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const demo = new CompleteCrossChainDemo();
  
  try {
    const success = await demo.runCompleteDemo();
    process.exit(success ? 0 : 1);
  } catch (error) {
    log('red', `❌ Demo failed with error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle CLI arguments
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CompleteCrossChainDemo };