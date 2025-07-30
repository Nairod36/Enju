const TronWeb = require('tronweb');

// Test de connexion avec votre API Key
const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  headers: { 
    "TRON-PRO-API-KEY": "5e8b38e2-9828-4737-af16-11b935808aca"
  }
});

async function testTronConnection() {
  try {
    console.log('🔍 Test de connexion Tron avec votre API Key...');
    
    // Test 1: Récupérer les infos du réseau
    const nodeInfo = await tronWeb.trx.getNodeInfo();
    console.log('✅ Connexion réussie au réseau Tron Shasta');
    console.log(`   Version: ${nodeInfo.configNodeInfo.codeVersion}`);
    
    // Test 2: Vérifier les limites de l'API
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    console.log(`✅ Block actuel: ${currentBlock.block_header.raw_data.number}`);
    
    // Test 3: Tester plusieurs appels (vérifier rate limiting)
    console.log('🚀 Test de 10 appels rapides...');
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(tronWeb.trx.getCurrentBlock());
    }
    
    await Promise.all(promises);
    console.log('✅ 10 appels simultanés réussis - Pas de rate limiting!');
    
    console.log('🎉 Votre API Key TronGrid fonctionne parfaitement!');
    console.log('📋 Prêt pour le déploiement du contrat bridge');
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    
    if (error.message.includes('429')) {
      console.log('⚠️  Rate limit dépassé - API Key peut-être invalide');
    } else if (error.message.includes('401')) {
      console.log('⚠️  API Key invalide ou expirée');
    } else {
      console.log('⚠️  Problème de connexion réseau');
    }
  }
}

// Lancer le test
testTronConnection();