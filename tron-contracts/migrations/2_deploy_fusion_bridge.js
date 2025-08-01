const TronFusionBridge = artifacts.require("TronFusionBridge");

module.exports = function(deployer, network, accounts) {
  console.log('🚀 Deploying TronFusionBridge (1inch Fusion+ Compatible) to network:', network);
  console.log('📋 Deployer account:', accounts[0]);
  console.log('💰 Estimated cost: ~400-800 TRX (optimized)');
  
  // Deploy with optimized gas settings
  deployer.deploy(TronFusionBridge, {
    // Optimize deployment parameters
    feeLimit: 800 * 1e6,  // 800 TRX max (increased for complex contract)
    userFeePercentage: 25  // Reduced percentage for deployment
  }).then((instance) => {
    console.log('✅ TronFusionBridge deployed at:', instance.address);
    
    console.log('\n📝 Add this to your .env file:');
    console.log(`TRON_FUSION_BRIDGE_CONTRACT=${instance.address}`);
    console.log(`USE_FUSION_BRIDGE=true`);
    
    console.log('\n✅ Full 1inch Fusion+ contract deployed with all features:');
    console.log('   - Multi-stage timelocks');
    console.log('   - Safety deposit mechanism');
    console.log('   - Emergency rescue functions');
    console.log('   - Complete Immutables support');
    console.log('   - Partial fills ready architecture');
    
    return instance;
  }).catch((error) => {
    console.error('❌ Deployment failed:', error.message);
    throw error;
  });
};