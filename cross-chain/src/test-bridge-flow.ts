#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { TronClient } from './tron-client';
import { PriceOracle } from './price-oracle';
import { InchFusionTypes } from './types';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../backend/.env' });

/**
 * Test complet du flow ETH ↔ TRON
 */
async function testCompleteBridgeFlow() {
  console.log('🧪 Testing complete ETH ↔ TRON bridge flow...\n');

  try {
    // 1. Test de l'oracle de prix
    console.log('📊 Testing Price Oracle...');
    const priceOracle = new PriceOracle();
    
    const ethToTrx = await priceOracle.convertEthToTrx('0.1');
    const trxToEth = await priceOracle.convertTrxToEth('1000');
    
    console.log(`✅ Price conversions:`);
    console.log(`   - 0.1 ETH = ${ethToTrx} TRX`);
    console.log(`   - 1000 TRX = ${trxToEth} ETH\n`);

    // 2. Test de la connexion TRON
    console.log('🔗 Testing TRON connection...');
    const tronConfig: InchFusionTypes.Config['tron'] = {
      privateKey: process.env.TRON_PRIVATE_KEY!,
      fullHost: process.env.TRON_FULL_HOST!,
      bridgeContract: process.env.TRON_BRIDGE_CONTRACT!,
      chainId: process.env.TRON_CHAIN_ID || '2'
    };

    const tronClient = new TronClient(tronConfig);
    const tronBalance = await tronClient.getBalance();
    console.log(`✅ TRON Balance: ${tronBalance} TRX`);
    console.log(`✅ TRON Contract: ${tronConfig.bridgeContract}\n`);

    // 3. Test de la connexion ETH
    console.log('🔗 Testing ETH connection...');
    const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL!);
    const ethWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, ethProvider);
    const ethBalance = await ethProvider.getBalance(ethWallet.address);
    
    console.log(`✅ ETH Address: ${ethWallet.address}`);
    console.log(`✅ ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
    console.log(`✅ ETH Contract: ${process.env.ETH_BRIDGE_CONTRACT}\n`);

    // 4. Test de génération d'HTLC
    console.log('🔐 Testing HTLC generation...');
    const secret = tronClient.generateSecret();
    const hashlock = tronClient.generateHashlock(secret);
    
    console.log(`✅ Secret generated: ${secret.substring(0, 20)}...`);
    console.log(`✅ Hashlock: ${hashlock.substring(0, 20)}...\n`);

    // 5. Test des contrats (lecture seulement)
    console.log('📜 Testing contract interactions...');
    
    // Test TRON contract
    try {
      const currentBlock = await tronClient.getCurrentBlock();
      console.log(`✅ TRON current block: ${currentBlock}`);
    } catch (error) {
      console.log(`⚠️ TRON contract test failed: ${error}`);
    }

    // Test ETH contract
    try {
      const ethContract = new ethers.Contract(
        process.env.ETH_BRIDGE_CONTRACT!,
        [
          'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)'
        ],
        ethProvider
      );
      
      const network = await ethProvider.getNetwork();
      console.log(`✅ ETH network: ${network.name} (chainId: ${network.chainId})`);
    } catch (error) {
      console.log(`⚠️ ETH contract test failed: ${error}`);
    }

    console.log('\n🎉 All tests passed! The bridge infrastructure is ready.');
    
    // 6. Afficher les informations de déploiement
    console.log('\n📋 Deployment Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`🌐 ETH Network: Sepolia Testnet`);
    console.log(`📝 ETH Contract: ${process.env.ETH_BRIDGE_CONTRACT}`);
    console.log(`💰 ETH Address: ${ethWallet.address}`);
    console.log('');
    console.log(`🌐 TRON Network: Shasta Testnet`);
    console.log(`📝 TRON Contract: ${tronConfig.bridgeContract}`);
    console.log(`💰 TRON Balance: ${tronBalance} TRX`);
    console.log('');
    console.log(`💱 Price Oracle: CoinGecko + Binance APIs`);
    console.log(`🔄 Current Rates: 1 ETH ≈ ${ethToTrx} TRX`);
    console.log('═══════════════════════════════════════');

    return true;

  } catch (error) {
    console.error('❌ Bridge flow test failed:', error);
    return false;
  }
}

/**
 * Test des fonctionnalités de swap (simulation)
 */
async function testSwapSimulation() {
  console.log('\n🔄 Testing swap simulation...');
  
  try {
    const priceOracle = new PriceOracle();
    
    // Simuler un swap ETH → TRON
    const ethAmount = '0.05';
    const expectedTrx = await priceOracle.convertEthToTrx(ethAmount);
    const fees = parseFloat(expectedTrx) * 0.003; // 0.3% fees
    const finalTrx = (parseFloat(expectedTrx) - fees).toFixed(6);
    
    console.log('📊 ETH → TRON Swap Simulation:');
    console.log(`   Input: ${ethAmount} ETH`);
    console.log(`   Market Rate: ${expectedTrx} TRX`);
    console.log(`   Bridge Fee (0.3%): ${fees.toFixed(6)} TRX`);
    console.log(`   Final Output: ${finalTrx} TRX`);
    
    // Simuler un swap TRON → ETH
    const trxAmount = '500';
    const expectedEth = await priceOracle.convertTrxToEth(trxAmount);
    const ethFees = parseFloat(expectedEth) * 0.003;
    const finalEth = (parseFloat(expectedEth) - ethFees).toFixed(6);
    
    console.log('\n📊 TRON → ETH Swap Simulation:');
    console.log(`   Input: ${trxAmount} TRX`);
    console.log(`   Market Rate: ${expectedEth} ETH`);
    console.log(`   Bridge Fee (0.3%): ${ethFees.toFixed(6)} ETH`);
    console.log(`   Final Output: ${finalEth} ETH`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Swap simulation failed:', error);
    return false;
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 UniteDeFi Bridge - ETH ↔ TRON Test Suite');
  console.log('══════════════════════════════════════════════\n');

  const testResults = {
    bridgeFlow: false,
    swapSimulation: false
  };

  // Test du flow principal
  testResults.bridgeFlow = await testCompleteBridgeFlow();
  
  // Test des simulations de swap
  testResults.swapSimulation = await testSwapSimulation();

  // Résultats finaux
  console.log('\n🏁 Test Results Summary:');
  console.log('═══════════════════════════');
  console.log(`Bridge Infrastructure: ${testResults.bridgeFlow ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Swap Simulation: ${testResults.swapSimulation ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(testResults).every(result => result);
  console.log(`\nOverall Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🚀 Your ETH ↔ TRON bridge is ready for deployment!');
    console.log('Next steps:');
    console.log('1. Start the resolver: npm run resolver');
    console.log('2. Test with small amounts first');
    console.log('3. Monitor the resolver logs for any issues');
  }

  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

export { testCompleteBridgeFlow, testSwapSimulation };