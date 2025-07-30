import { PriceOracle } from './price-oracle';

async function testPriceOracle() {
  console.log('🧪 Testing Price Oracle...\n');
  
  const oracle = new PriceOracle();
  
  try {
    // Test getting current prices
    console.log('1. Getting current TRX/ETH prices...');
    const prices = await oracle.getCurrentPrices();
    console.log(`📊 Current prices:`, prices);
    console.log();
    
    // Test TRX to ETH conversion
    console.log('2. Testing TRX to ETH conversion...');
    const trxAmount = '1000'; // 1000 TRX
    const ethEquivalent = await oracle.convertTrxToEth(trxAmount);
    console.log(`💱 ${trxAmount} TRX = ${ethEquivalent} ETH`);
    console.log();
    
    // Test ETH to TRX conversion
    console.log('3. Testing ETH to TRX conversion...');
    const ethAmount = '0.1'; // 0.1 ETH
    const trxEquivalent = await oracle.convertEthToTrx(ethAmount);
    console.log(`💱 ${ethAmount} ETH = ${trxEquivalent} TRX`);
    console.log();
    
    // Test NEAR to ETH conversion
    console.log('4. Testing NEAR to ETH conversion...');
    const nearAmount = '100'; // 100 NEAR
    const ethFromNear = await oracle.convertNearToEth(nearAmount);
    console.log(`💱 ${nearAmount} NEAR = ${ethFromNear} ETH`);
    console.log();
    
    // Test ETH to NEAR conversion
    console.log('5. Testing ETH to NEAR conversion...');
    const ethAmount2 = '0.1'; // 0.1 ETH
    const nearEquivalent = await oracle.convertEthToNear(ethAmount2);
    console.log(`💱 ${ethAmount2} ETH = ${nearEquivalent} NEAR`);
    console.log();
    
    // Test bridge fee calculation
    console.log('6. Testing bridge fee calculation...');
    const feeCalc = await oracle.calculateBridgeFee('1000', 'TRX');
    console.log(`💰 Bridge fee for 1000 TRX:`, feeCalc);
    
    const nearFeeCalc = await oracle.calculateBridgeFee('100', 'NEAR');
    console.log(`💰 Bridge fee for 100 NEAR:`, nearFeeCalc);
    console.log();
    
    // Test cache functionality
    console.log('7. Testing cache (should be faster)...');
    const startTime = Date.now();
    const cachedPrices = await oracle.getCurrentPrices();
    const endTime = Date.now();
    console.log(`⚡ Cached request took ${endTime - startTime}ms`);
    console.log(`📊 Cached prices source:`, cachedPrices.source);
    console.log();
    
    // Test price stats
    console.log('8. Price oracle stats...');
    const stats = oracle.getPriceStats();
    console.log(`📈 Oracle stats:`, stats);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPriceOracle();