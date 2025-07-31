const { TronWeb } = require('tronweb');

async function debugTronTransactions() {
  try {
    console.log('🔍 Debugging TRON → ETH transactions...');
    
    // Configuration TRON
    const tronConfig = {
      privateKey: '45388b9d2472ff83a3d8a948f7450058dea43fae47e7d71513154bae46a68e17',
      fullHost: 'https://api.shasta.trongrid.io',
      bridgeContract: 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86'
    };

    const cleanPrivateKey = tronConfig.privateKey.startsWith('0x') 
      ? tronConfig.privateKey.slice(2) 
      : tronConfig.privateKey;

    const tronWeb = new TronWeb({
      fullHost: tronConfig.fullHost,
      privateKey: cleanPrivateKey,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });

    const bridgeContractAddress = tronConfig.bridgeContract;
    const targetEthAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    
    console.log('📋 Bridge Contract:', bridgeContractAddress);
    console.log('📋 Target ETH Address:', targetEthAddress);
    
    // 1. Vérifier les transactions récentes vers le contrat bridge
    console.log('\n🔍 Checking recent transactions to bridge contract...');
    
    try {
      const transactions = await tronWeb.trx.getTransactionsFromAddress(bridgeContractAddress, 20);
      console.log(`📊 Found ${transactions.length} recent transactions`);
      
      for (let i = 0; i < Math.min(transactions.length, 5); i++) {
        const tx = transactions[i];
        console.log(`\nTransaction ${i + 1}:`);
        console.log(`  Hash: ${tx.txID}`);
        console.log(`  From: ${tx.raw_data.contract[0].parameter.value.owner_address ? tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address) : 'N/A'}`);
        console.log(`  To: ${tx.raw_data.contract[0].parameter.value.to_address ? tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.to_address) : 'N/A'}`);
        console.log(`  Amount: ${tx.raw_data.contract[0].parameter.value.amount ? tronWeb.fromSun(tx.raw_data.contract[0].parameter.value.amount) : 'N/A'} TRX`);
        console.log(`  Time: ${new Date(tx.block_timestamp).toLocaleString()}`);
      }
    } catch (error) {
      console.log('❌ Failed to get transactions:', error.message);
    }
    
    // 2. Vérifier le solde du contrat bridge
    console.log('\n💰 Checking bridge contract balance...');
    try {
      const balance = await tronWeb.trx.getBalance(bridgeContractAddress);
      const balanceInTrx = tronWeb.fromSun(balance);
      console.log(`📊 Bridge contract balance: ${balanceInTrx} TRX`);
    } catch (error) {
      console.log('❌ Failed to get balance:', error.message);
    }
    
    // 3. Simuler la conversion TRX → ETH pour vos transactions
    console.log('\n💱 Simulating TRX → ETH conversion...');
    const trxToEthRate = 0.000086786310296416; // Du rate oracle
    
    // Exemples de montants TRX que vous pourriez avoir envoyés
    const testAmounts = ['100', '500', '1000', '2000'];
    
    for (const trxAmount of testAmounts) {
      const ethAmount = (parseFloat(trxAmount) * trxToEthRate).toFixed(6);
      console.log(`  ${trxAmount} TRX → ${ethAmount} ETH`);
    }
    
    console.log('\n📋 Debug Summary:');
    console.log('- Check if your TRX transactions appear in the list above');
    console.log('- Verify the bridge contract received your TRX');
    console.log('- Expected ETH amounts are shown for common TRX values');
    console.log(`- ETH should be sent to: ${targetEthAddress}`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugTronTransactions();