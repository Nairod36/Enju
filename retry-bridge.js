// Script pour traiter rétroactivement le bridge ETH → TRON de 1 ETH
const { TronWeb } = require('tronweb');

async function retryBridge() {
  try {
    // Configuration de votre bridge échoué
    const bridgeData = {
      hashlock: '0x7e41ed74e4076576ebf626a3241a5c61be1b89f8270a171e3cfd8fb9a78b9724',
      secret: '0xa2d0ad8b5f801000a2a5b0bb3e86972b4c7cb222875bc7cfb86984e3a89c858d',
      ethAmount: '1.0',
      tronAddress: 'TMGSeM3QLUJEbdscQnMt9ujx843arknWb2'
    };

    console.log('🔄 Processing missed ETH → TRON bridge...');
    console.log('💱 Amount:', bridgeData.ethAmount, 'ETH');
    console.log('📍 TRON Address:', bridgeData.tronAddress);

    // Calculer TRX équivalent (1 ETH ≈ 11,522 TRX)
    const ethToTrxRate = 11522.554612409844; // Du rate oracle
    const trxAmount = (parseFloat(bridgeData.ethAmount) * ethToTrxRate).toString();
    
    console.log('💱 Converting to:', trxAmount, 'TRX');

    // Configuration TRON
    const tronConfig = {
      privateKey: '45388b9d2472ff83a3d8a948f7450058dea43fae47e7d71513154bae46a68e17',
      fullHost: 'https://api.shasta.trongrid.io'
    };

    const cleanPrivateKey = tronConfig.privateKey.startsWith('0x') 
      ? tronConfig.privateKey.slice(2) 
      : tronConfig.privateKey;

    const tronWeb = new TronWeb({
      fullHost: tronConfig.fullHost,
      privateKey: cleanPrivateKey,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });

    const fromAddress = tronWeb.defaultAddress.base58;
    
    console.log('📊 From (relayer):', fromAddress);
    console.log('📊 To (user):', bridgeData.tronAddress);

    // Vérifier le solde
    const balance = await tronWeb.trx.getBalance(fromAddress);
    const balanceInTrx = tronWeb.fromSun(balance);
    
    console.log('💰 Relayer balance:', balanceInTrx, 'TRX');

    if (parseFloat(balanceInTrx) < parseFloat(trxAmount)) {
      console.log('❌ Insufficient balance for TRX transfer');
      console.log('💡 Required:', trxAmount, 'TRX');
      console.log('💡 Available:', balanceInTrx, 'TRX');
      return;
    }

    // Envoyer les TRX
    const amountInSun = tronWeb.toSun(trxAmount);
    
    console.log(`💸 Sending ${trxAmount} TRX to ${bridgeData.tronAddress}...`);
    
    const transaction = await tronWeb.trx.sendTransaction(bridgeData.tronAddress, amountInSun);
    
    console.log(`✅ TRX transaction sent: ${transaction.txid}`);
    console.log(`🔗 Check on TronScan: https://shasta.tronscan.org/#/transaction/${transaction.txid}`);
    
    // Informer l'utilisateur
    console.log('');
    console.log('🎉 BRIDGE RECOVERED SUCCESSFULLY!');
    console.log(`📤 Sent: ${trxAmount} TRX`);
    console.log(`📍 To: ${bridgeData.tronAddress}`);
    console.log(`💱 Equivalent: ${bridgeData.ethAmount} ETH`);
    
  } catch (error) {
    console.error('❌ Bridge recovery failed:', error);
  }
}

retryBridge();