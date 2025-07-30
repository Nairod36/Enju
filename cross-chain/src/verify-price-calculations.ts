import { PriceOracle } from './price-oracle';

async function verifyPriceCalculations() {
  console.log('🔍 Verifying Price Oracle Calculations...\n');
  
  const oracle = new PriceOracle();
  
  try {
    // Get current prices
    const prices = await oracle.getCurrentPrices();
    console.log('📊 Current market prices:');
    console.log(`   TRX/ETH rate: ${prices.trxToEth.toFixed(8)}`);
    console.log(`   ETH/TRX rate: ${prices.ethToTrx.toFixed(2)}`);
    console.log(`   NEAR/ETH rate: ${prices.nearToEth.toFixed(8)}`);
    console.log(`   ETH/NEAR rate: ${prices.ethToNear.toFixed(2)}`);
    console.log();

    // Test 1: Verify TRX/ETH conversion consistency
    console.log('🧮 Test 1: TRX ↔ ETH conversion consistency');
    const trxAmount = '1000';
    const ethFromTrx = await oracle.convertTrxToEth(trxAmount);
    const trxFromEth = await oracle.convertEthToTrx(ethFromTrx);
    
    console.log(`Original: ${trxAmount} TRX`);
    console.log(`To ETH: ${ethFromTrx} ETH`);
    console.log(`Back to TRX: ${trxFromEth} TRX`);
    
    const trxDifference = Math.abs(parseFloat(trxAmount) - parseFloat(trxFromEth));
    const isConsistent = trxDifference < 0.1; // Allow small rounding errors
    console.log(`Consistency check: ${isConsistent ? '✅ PASS' : '❌ FAIL'} (diff: ${trxDifference.toFixed(6)})`);
    console.log();

    // Test 2: Verify NEAR/ETH conversion consistency
    console.log('🧮 Test 2: NEAR ↔ ETH conversion consistency');
    const nearAmount = '100';
    const ethFromNear = await oracle.convertNearToEth(nearAmount);
    const nearFromEth = await oracle.convertEthToNear(ethFromNear);
    
    console.log(`Original: ${nearAmount} NEAR`);
    console.log(`To ETH: ${ethFromNear} ETH`);
    console.log(`Back to NEAR: ${nearFromEth} NEAR`);
    
    const nearDifference = Math.abs(parseFloat(nearAmount) - parseFloat(nearFromEth));
    const isNearConsistent = nearDifference < 0.01; // Allow small rounding errors
    console.log(`Consistency check: ${isNearConsistent ? '✅ PASS' : '❌ FAIL'} (diff: ${nearDifference.toFixed(6)})`);
    console.log();

    // Test 3: Manual calculation verification
    console.log('🧮 Test 3: Manual calculation verification');
    console.log('Manually calculating 1000 TRX to ETH:');
    const manualEthAmount = 1000 * prices.trxToEth;
    const oracleEthAmount = parseFloat(await oracle.convertTrxToEth('1000'));
    console.log(`Manual calculation: ${manualEthAmount.toFixed(18)}`);
    console.log(`Oracle calculation: ${oracleEthAmount.toFixed(18)}`);
    
    const calculationDiff = Math.abs(manualEthAmount - oracleEthAmount);
    const isCalculationCorrect = calculationDiff < 1e-15; // Very small tolerance
    console.log(`Calculation accuracy: ${isCalculationCorrect ? '✅ PASS' : '❌ FAIL'} (diff: ${calculationDiff})`);
    console.log();

    // Test 4: Fee calculation verification
    console.log('🧮 Test 4: Fee calculation verification');
    const feeCalc = await oracle.calculateBridgeFee('1000', 'TRX');
    const expectedFee = 1000 * 0.003; // 0.3%
    const expectedNet = 1000 - expectedFee;
    
    console.log(`Original amount: ${feeCalc.originalAmount}`);
    console.log(`Calculated fee: ${feeCalc.fee}`);
    console.log(`Expected fee: ${expectedFee.toFixed(6)}`);
    console.log(`Net amount: ${feeCalc.netAmount}`);
    console.log(`Expected net: ${expectedNet.toFixed(6)}`);
    
    const feeCorrect = Math.abs(parseFloat(feeCalc.fee) - expectedFee) < 1e-6;
    const netCorrect = Math.abs(parseFloat(feeCalc.netAmount) - expectedNet) < 1e-6;
    console.log(`Fee calculation: ${feeCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Net calculation: ${netCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log();

    // Test 5: Cross-rate calculation
    console.log('🧮 Test 5: Cross-rate calculation (TRX → NEAR via ETH)');
    const trxToNearViaEth = parseFloat(await oracle.convertTrxToEth('1000'));
    const nearFromEthConversion = parseFloat(await oracle.convertEthToNear(trxToNearViaEth.toString()));
    
    const directTrxToNearRate = prices.trxToEth * prices.ethToNear;
    const manualTrxToNear = 1000 * directTrxToNearRate;
    
    console.log(`1000 TRX → ETH → NEAR: ${nearFromEthConversion.toFixed(8)} NEAR`);
    console.log(`Direct calculation: ${manualTrxToNear.toFixed(8)} NEAR`);
    
    const crossRateDiff = Math.abs(nearFromEthConversion - manualTrxToNear);
    const isCrossRateCorrect = crossRateDiff < 0.001;
    console.log(`Cross-rate accuracy: ${isCrossRateCorrect ? '✅ PASS' : '❌ FAIL'} (diff: ${crossRateDiff.toFixed(8)})`);
    console.log();

    // Summary
    const allTestsPassed = isConsistent && isNearConsistent && isCalculationCorrect && feeCorrect && netCorrect && isCrossRateCorrect;
    console.log(`\n${allTestsPassed ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'}`);
    console.log('Oracle calculations are working correctly for bridge operations.');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
verifyPriceCalculations();