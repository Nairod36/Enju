#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { TronClient } from './tron-client';
import { PriceOracle } from './price-oracle';
import { InchFusionTypes } from './types';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../backend/.env' });

/**
 * Test avec de vraies transactions sur testnet
 */
class RealTransactionTest {
  private ethProvider: ethers.JsonRpcProvider;
  private ethWallet: ethers.Wallet;
  private tronClient: TronClient;
  private priceOracle: PriceOracle;
  private ethBridgeContract: ethers.Contract;

  constructor() {
    // Configuration ETH
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL!);
    this.ethWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, this.ethProvider);
    
    // Configuration TRON
    const tronConfig: InchFusionTypes.Config['tron'] = {
      privateKey: process.env.TRON_PRIVATE_KEY!,
      fullHost: process.env.TRON_FULL_HOST!,
      bridgeContract: process.env.TRON_BRIDGE_CONTRACT!,
      chainId: process.env.TRON_CHAIN_ID || '2'
    };
    this.tronClient = new TronClient(tronConfig);
    
    // Oracle de prix
    this.priceOracle = new PriceOracle();
    
    // Contrat ETH Bridge
    this.ethBridgeContract = new ethers.Contract(
      process.env.ETH_BRIDGE_CONTRACT!,
      [
        'function createSwap(bytes32 hashlock, string calldata targetAccount) external payable returns (bytes32)',
        'function completeSwap(bytes32 swapId, bytes32 secret) external',
        'function refundSwap(bytes32 swapId) external',
        'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)',
        'event SwapCreated(bytes32 indexed swapId, address indexed user, uint256 amount, bytes32 hashlock, string targetChain)',
        'event SwapCompleted(bytes32 indexed swapId, bytes32 secret)',
        'event SwapRefunded(bytes32 indexed swapId)'
      ],
      this.ethWallet
    );
  }

  /**
   * Test 1: Transaction ETH réelle - Créer un swap ETH → TRON
   */
  async testRealEthToTronSwap(ethAmount: string = '0.001'): Promise<string | null> {
    console.log('\n🔥 TEST 1: Vraie transaction ETH → TRON');
    console.log('═══════════════════════════════════════');
    
    try {
      // 1. Vérifier le balance ETH
      const ethBalance = await this.ethProvider.getBalance(this.ethWallet.address);
      console.log(`💰 ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
      
      if (parseFloat(ethers.formatEther(ethBalance)) < parseFloat(ethAmount)) {
        console.log('❌ Insufficient ETH balance for test');
        return null;
      }

      // 2. Générer HTLC
      const secret = this.tronClient.generateSecret();
      const hashlock = this.tronClient.generateHashlock(secret);
      
      console.log(`🔐 Secret: ${secret}`);
      console.log(`🔐 Hashlock: ${hashlock}`);

      // 3. Calculer l'équivalent TRX
      const trxAmount = await this.priceOracle.convertEthToTrx(ethAmount);
      console.log(`💱 ${ethAmount} ETH → ${trxAmount} TRX`);

      // 4. Créer le swap ETH réel
      console.log('📝 Creating real ETH swap transaction...');
      const tx = await this.ethBridgeContract.createSwap(
        hashlock,
        'TRON_ADDRESS_PLACEHOLDER', // Adresse TRON de destination
        {
          value: ethers.parseEther(ethAmount),
          gasLimit: 300000
        }
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      
      // 5. Attendre la confirmation
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
      
      // 6. Extraire le swapId des logs
      const swapCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = this.ethBridgeContract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsed?.name === 'SwapCreated';
        } catch {
          return false;
        }
      });

      if (swapCreatedEvent) {
        const parsed = this.ethBridgeContract.interface.parseLog({
          topics: swapCreatedEvent.topics,
          data: swapCreatedEvent.data
        });
        const swapId = parsed?.args.swapId;
        console.log(`🆔 Swap ID: ${swapId}`);
        
        // 7. Vérifier le swap créé
        const swapDetails = await this.ethBridgeContract.getSwap(swapId);
        console.log('📊 Swap Details:', {
          user: swapDetails.user,
          amount: ethers.formatEther(swapDetails.amount),
          hashlock: swapDetails.hashlock,
          targetAccount: swapDetails.targetAccount,
          completed: swapDetails.completed,
          refunded: swapDetails.refunded
        });

        return swapId;
      }

      return null;
    } catch (error) {
      console.error('❌ ETH swap failed:', error);
      return null;
    }
  }

  /**
   * Test 2: Transaction TRON réelle - Créer un bridge TRON
   */
  async testRealTronBridge(trxAmount: string = '100'): Promise<string | null> {
    console.log('\n🔥 TEST 2: Vraie transaction TRON Bridge');
    console.log('═══════════════════════════════════════');
    
    try {
      // 1. Vérifier le balance TRX
      const tronBalance = await this.tronClient.getBalance();
      console.log(`💰 TRX Balance: ${tronBalance} TRX`);
      
      if (parseFloat(tronBalance) < parseFloat(trxAmount)) {
        console.log('❌ Insufficient TRX balance for test');
        return null;
      }

      // 2. Générer HTLC
      const secret = this.tronClient.generateSecret();
      const hashlock = this.tronClient.generateHashlock(secret);
      
      console.log(`🔐 Secret: ${secret}`);
      console.log(`🔐 Hashlock: ${hashlock}`);

      // 3. Créer le bridge TRON réel
      console.log('📝 Creating real TRON bridge transaction...');
      const result = await this.tronClient.createTronBridge(
        hashlock,
        this.ethWallet.address, // Adresse ETH de destination
        'ethereum',
        trxAmount
      );

      if (result.success) {
        console.log(`✅ TRON Bridge created!`);
        console.log(`📋 Transaction Hash: ${result.txHash}`);
        console.log(`🆔 Swap ID: ${result.swapId}`);
        
        // 4. Attendre quelques secondes pour confirmation
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 5. Vérifier le swap créé sur TRON
        if (result.swapId) {
          try {
            const swapDetails = await this.tronClient.getSwap(result.swapId);
            console.log('📊 TRON Swap Details:', swapDetails);
          } catch (error) {
            console.log('⚠️ Could not fetch TRON swap details:', error);
          }
        }

        return result.swapId || null;
      } else {
        console.error('❌ TRON bridge failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ TRON bridge failed:', error);
      return null;
    }
  }

  /**
   * Test 3: Compléter un swap avec le secret
   */
  async testCompleteSwap(swapId: string, secret: string, chain: 'ETH' | 'TRON'): Promise<boolean> {
    console.log(`\n🔥 TEST 3: Compléter swap ${chain}`);
    console.log('═══════════════════════════════════════');
    
    try {
      if (chain === 'ETH') {
        console.log('📝 Completing ETH swap...');
        const tx = await this.ethBridgeContract.completeSwap(swapId, secret, {
          gasLimit: 200000
        });
        
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ ETH swap completed in block: ${receipt.blockNumber}`);
        
        return true;
      } else {
        console.log('📝 Completing TRON swap...');
        const result = await this.tronClient.completeSwap(swapId, secret);
        
        if (result.success) {
          console.log(`✅ TRON swap completed: ${result.txHash}`);
          return true;
        } else {
          console.error('❌ TRON completion failed:', result.error);
          return false;
        }
      }
    } catch (error) {
      console.error(`❌ ${chain} swap completion failed:`, error);
      return false;
    }
  }

  /**
   * Test complet end-to-end
   */
  async testFullEndToEndSwap(): Promise<void> {
    console.log('\n🚀 TEST COMPLET END-TO-END ETH ↔ TRON');
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // Phase 1: ETH → TRON
      console.log('\n📍 PHASE 1: ETH → TRON');
      const ethSwapId = await this.testRealEthToTronSwap('0.001');
      
      if (!ethSwapId) {
        console.log('❌ ETH swap failed, stopping test');
        return;
      }

      // Phase 2: TRON Bridge correspondant
      console.log('\n📍 PHASE 2: TRON Bridge correspondant');
      const tronSwapId = await this.testRealTronBridge('50');
      
      if (!tronSwapId) {
        console.log('❌ TRON bridge failed, stopping test');
        return;
      }

      console.log('\n🎉 Tests de transactions réelles terminés!');
      console.log('═══════════════════════════════════════');
      console.log(`✅ ETH Swap ID: ${ethSwapId}`);
      console.log(`✅ TRON Swap ID: ${tronSwapId}`);
      console.log('\n📋 Pour compléter les swaps:');
      console.log('1. Révéler le secret sur une chaîne');
      console.log('2. Utiliser le secret révélé pour compléter l\'autre chaîne');
      console.log('3. Les fonds seront transférés automatiquement');

    } catch (error) {
      console.error('❌ End-to-end test failed:', error);
    }
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 TESTS DE TRANSACTIONS RÉELLES ETH ↔ TRON');
  console.log('════════════════════════════════════════════════════');
  console.log('⚠️  ATTENTION: Ces tests utilisent de vraies transactions sur testnet');
  console.log('💰 Assurez-vous d\'avoir des fonds ETH (Sepolia) et TRX (Shasta)');
  console.log('════════════════════════════════════════════════════\n');

  const tester = new RealTransactionTest();
  
  const testType = process.argv[2];
  
  switch (testType) {
    case 'eth':
      await tester.testRealEthToTronSwap();
      break;
    case 'tron':
      await tester.testRealTronBridge();
      break;
    case 'full':
      await tester.testFullEndToEndSwap();
      break;
    default:
      console.log('Usage:');
      console.log('  npm run test:real eth    - Test transaction ETH');
      console.log('  npm run test:real tron   - Test transaction TRON');
      console.log('  npm run test:real full   - Test complet end-to-end');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { RealTransactionTest };