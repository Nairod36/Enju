#!/usr/bin/env tsx

import { PriceOracle } from './src/services/price-oracle';

/**
 * Test de la conversion ETH → NEAR avec le PriceOracle
 */
async function testEthToNearConversion() {
  console.log('🧪 Testing ETH → NEAR conversion with PriceOracle');
  console.log('═══════════════════════════════════════════════════');
  
  const priceOracle = new PriceOracle();
  
  try {
    // Test différents montants ETH
    const testAmounts = ['0.001', '0.01', '0.1', '1.0'];
    
    for (const ethAmount of testAmounts) {
      console.log(`\n💱 Converting ${ethAmount} ETH to NEAR...`);
      
      const nearAmount = await priceOracle.convertEthToNear(ethAmount);
      const nearYocto = BigInt(Math.floor(parseFloat(nearAmount) * 1e24));
      
      console.log(`✅ Result: ${ethAmount} ETH → ${nearAmount} NEAR`);
      console.log(`📊 yoctoNEAR: ${nearYocto.toString()}`);
      console.log(`📈 Rate: 1 ETH = ${(parseFloat(nearAmount) / parseFloat(ethAmount)).toFixed(4)} NEAR`);
    }
    
    // Afficher les taux actuels
    console.log('\n📊 Current Market Rates:');
    console.log('═══════════════════════');
    const prices = await priceOracle.getCurrentPrices();
    console.log(`ETH/NEAR rate: ${prices.ethToNear}`);
    console.log(`NEAR/ETH rate: ${prices.nearToEth}`);
    console.log(`Source: ${prices.source}`);
    console.log(`Timestamp: ${new Date(prices.timestamp).toISOString()}`);
    
  } catch (error) {
    console.error('❌ Conversion test failed:', error);
  }
}

/**
 * Simuler la conversion comme dans near-listener
 */
async function simulateNearListenerConversion() {
  console.log('\n🔧 Simulating near-listener conversion logic');
  console.log('═══════════════════════════════════════════════');
  
  const priceOracle = new PriceOracle();
  
  // Simuler différents montants ETH en wei
  const testWeiAmounts = [
    '1000000000000000',    // 0.001 ETH
    '10000000000000000',   // 0.01 ETH  
    '100000000000000000',  // 0.1 ETH
    '1000000000000000000', // 1.0 ETH
  ];
  
  for (const weiAmount of testWeiAmounts) {
    console.log(`\n🔄 Processing ${weiAmount} wei...`);
    
    // Logic from near-listener.ts
    const ethWei = BigInt(weiAmount);
    const ethAmount = Number(ethWei) / 1e18; // Convert wei to ETH
    
    console.log(`💱 Converting ${ethAmount} ETH to NEAR using market rates...`);
    
    // Get real market conversion rate
    const nearAmount = await priceOracle.convertEthToNear(ethAmount.toString());
    const nearYocto = BigInt(Math.floor(parseFloat(nearAmount) * 1e24)); // Convert to yoctoNEAR
    
    console.log(`💰 Conversion: ${ethAmount} ETH → ${nearAmount} NEAR (${nearYocto.toString()} yoctoNEAR)`);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 ETH → NEAR CONVERSION TEST WITH PRICE ORACLE');
  console.log('════════════════════════════════════════════════════════════');
  
  await testEthToNearConversion();
  await simulateNearListenerConversion();
  
  console.log('\n✅ Conversion tests completed!');
}

if (require.main === module) {
  main().catch(console.error);
}