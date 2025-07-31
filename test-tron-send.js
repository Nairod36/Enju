const { TronWeb } = require('tronweb');
const crypto = require('crypto');

async function testTronSend() {
  try {
    // Configuration TRON depuis le .env
    const config = {
      privateKey: '45388b9d2472ff83a3d8a948f7450058dea43fae47e7d71513154bae46a68e17',
      fullHost: 'https://api.shasta.trongrid.io',
      bridgeContract: 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86'
    };
    
    // Nettoyer la clé privée (enlever le préfixe 0x si présent)
    const cleanPrivateKey = config.privateKey.startsWith('0x') 
      ? config.privateKey.slice(2) 
      : config.privateKey;
    
    console.log('🔧 Initializing TronWeb...');
    
    // Initialize TronWeb
    const tronWeb = new TronWeb({
      fullHost: config.fullHost,
      privateKey: cleanPrivateKey,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });
    
    const fromAddress = tronWeb.defaultAddress.base58;
    const toAddress = 'TMGSeM3QLUJEbdscQnMt9ujx843arknWb2';
    
    console.log('📊 From address:', fromAddress);
    console.log('📊 To address:', toAddress);
    
    // Check balance
    const balance = await tronWeb.trx.getBalance(fromAddress);
    const balanceInTrx = tronWeb.fromSun(balance);
    
    console.log('💰 Current balance:', balanceInTrx, 'TRX');
    
    if (parseFloat(balanceInTrx) < 100) {
      console.log('❌ Insufficient balance for TRX transfer');
      return;
    }
    
    // Send test amount
    const testAmount = '100'; // 100 TRX
    const amountInSun = tronWeb.toSun(testAmount);
    
    console.log(`📤 Sending ${testAmount} TRX to ${toAddress}...`);
    
    // Send TRX transaction
    const transaction = await tronWeb.trx.sendTransaction(toAddress, amountInSun);
    
    console.log(`✅ TRX transaction sent: ${transaction.txid}`);
    console.log(`🔗 Check on TronScan: https://shasta.tronscan.org/#/transaction/${transaction.txid}`);
    
  } catch (error) {
    console.error('❌ TRX test failed:', error);
  }
}

testTronSend();