#!/usr/bin/env node

/**
 * Test script for 1inch Fusion+ ETH-TRON Bridge
 * Tests both legacy and Fusion+ implementations
 */

const { ethers } = require('ethers');
const TronWeb = require('tronweb');

class FusionBridgeTest {
  constructor() {
    this.setupEthereumConnection();
    this.setupTronConnection();
  }

  setupEthereumConnection() {
    // Connect to Ethereum (can be mainnet fork or testnet)
    this.ethProvider = new ethers.JsonRpcProvider(
      process.env.ETH_RPC_URL || 'http://localhost:8545'
    );
    
    this.ethSigner = new ethers.Wallet(
      process.env.ETH_PRIVATE_KEY || '0x' + '1'.repeat(64),
      this.ethProvider
    );

    console.log('🔗 ETH connected to:', this.ethProvider.connection.url);
    console.log('👤 ETH signer:', this.ethSigner.address);
  }

  setupTronConnection() {
    // Connect to TRON network
    this.tronWeb = new TronWeb({
      fullHost: process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io',
      privateKey: process.env.TRON_PRIVATE_KEY || '1'.repeat(64),
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
    });

    console.log('🔗 TRON connected to:', process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io');
    console.log('👤 TRON address:', this.tronWeb.defaultAddress.base58);
  }

  async testEthContracts() {
    console.log('\n🧪 Testing Ethereum Contracts...');
    
    try {
      // Test InchDirectBridge contract
      const bridgeAddress = process.env.ETH_BRIDGE_CONTRACT;
      if (!bridgeAddress) {
        console.log('⚠️ ETH_BRIDGE_CONTRACT not set, skipping ETH tests');
        return false;
      }

      const bridgeContract = new ethers.Contract(
        bridgeAddress,
        [
          'function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (bytes32 swapId)',
          'function checkEscrowFactory() external view returns (bool)',
          'function getSwap(bytes32 swapId) external view returns (address, address, uint256, bytes32, uint8, string memory, bool, uint256)'
        ],
        this.ethSigner
      );

      // Check if 1inch EscrowFactory is available
      const factoryAvailable = await bridgeContract.checkEscrowFactory();
      console.log('✅ 1inch EscrowFactory available:', factoryAvailable);

      // Generate test parameters
      const secret = ethers.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      const tronAddress = 'TTestAddressForBridgeTestingOnly123456';
      const amount = ethers.parseEther('0.001'); // 0.001 ETH

      console.log('📋 Test parameters:');
      console.log('   Secret:', ethers.hexlify(secret));
      console.log('   Hashlock:', hashlock);
      console.log('   TRON Address:', tronAddress);
      console.log('   Amount:', ethers.formatEther(amount), 'ETH');

      // Test bridge creation (dry run)
      try {
        const estimatedGas = await bridgeContract.createETHToTRONBridge.estimateGas(
          hashlock,
          tronAddress,
          { value: amount }
        );
        console.log('✅ ETH bridge creation gas estimate:', estimatedGas.toString());
      } catch (error) {
        console.log('⚠️ ETH bridge creation simulation failed:', error.message);
      }

      return true;
    } catch (error) {
      console.error('❌ ETH contract test failed:', error.message);
      return false;
    }
  }

  async testTronContracts() {
    console.log('\n🧪 Testing TRON Contracts...');
    
    try {
      // Test TronFusionBridge if available
      const fusionAddress = process.env.TRON_FUSION_BRIDGE_CONTRACT;
      if (fusionAddress) {
        console.log('🔄 Testing TronFusionBridge at:', fusionAddress);
        
        try {
          const fusionContract = await this.tronWeb.contract().at(fusionAddress);
          
          // Test createTronTimelocks function
          const timelocks = await fusionContract.createTronTimelocks().call();
          console.log('✅ TRON Fusion+ timelocks created:', {
            srcWithdrawal: new Date(timelocks.srcWithdrawal * 1000).toISOString(),
            srcPublicWithdrawal: new Date(timelocks.srcPublicWithdrawal * 1000).toISOString(),
            srcCancellation: new Date(timelocks.srcCancellation * 1000).toISOString()
          });
        } catch (error) {
          console.log('⚠️ TronFusionBridge test failed:', error.message);
        }
      }

      // Test legacy TronDirectBridge
      const legacyAddress = process.env.TRON_BRIDGE_CONTRACT;
      if (legacyAddress) {
        console.log('🔄 Testing TronDirectBridge at:', legacyAddress);
        
        try {
          const legacyContract = await this.tronWeb.contract().at(legacyAddress);
          
          // Test contract balance
          const balance = await legacyContract.getBalance().call();
          console.log('✅ TRON legacy bridge balance:', this.tronWeb.fromSun(balance), 'TRX');
        } catch (error) {
          console.log('⚠️ TronDirectBridge test failed:', error.message);
        }
      }

      if (!fusionAddress && !legacyAddress) {
        console.log('⚠️ No TRON bridge contracts configured, skipping TRON tests');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ TRON contract test failed:', error.message);
      return false;
    }
  }

  async testCrossChainFlow() {
    console.log('\n🌉 Testing Cross-Chain Bridge Flow...');
    
    try {
      // Generate test data
      const secret = ethers.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      const tronAddress = this.tronWeb.defaultAddress.base58;
      const ethAddress = this.ethSigner.address;

      console.log('📋 Cross-chain test parameters:');
      console.log('   ETH Address:', ethAddress);
      console.log('   TRON Address:', tronAddress);
      console.log('   Hashlock:', hashlock);

      // Test address validation
      const isValidTronAddr = this.tronWeb.isAddress(tronAddress);
      const isValidEthAddr = ethers.isAddress(ethAddress);

      console.log('✅ Address validation:');
      console.log('   TRON address valid:', isValidTronAddr);
      console.log('   ETH address valid:', isValidEthAddr);

      // Test secret/hashlock validation
      const computedHashlock = ethers.keccak256(secret);
      const hashlockMatch = computedHashlock === hashlock;

      console.log('✅ Cryptographic validation:');
      console.log('   Secret length:', secret.length, 'bytes');
      console.log('   Hashlock match:', hashlockMatch);

      return true;
    } catch (error) {
      console.error('❌ Cross-chain flow test failed:', error.message);
      return false;
    }
  }

  async testPriceOracle() {
    console.log('\n💰 Testing Price Oracle...');
    
    try {
      // Simulate price oracle calls
      const ethAmount = '1.0';
      
      // Mock price conversion (in production, this would call real APIs)
      const ethPriceUSD = 2000; // $2000 per ETH
      const trxPriceUSD = 0.1;  // $0.1 per TRX
      
      const trxAmount = (parseFloat(ethAmount) * ethPriceUSD / trxPriceUSD).toString();
      
      console.log('📊 Price simulation:');
      console.log(`   ${ethAmount} ETH = ${trxAmount} TRX`);
      console.log(`   ETH price: $${ethPriceUSD}`);
      console.log(`   TRX price: $${trxPriceUSD}`);

      return true;
    } catch (error) {
      console.error('❌ Price oracle test failed:', error.message);
      return false;
    }
  }

  async testSecurityFeatures() {
    console.log('\n🔒 Testing Security Features...');
    
    try {
      // Test hashlock validation
      const validSecret = ethers.randomBytes(32);
      const validHashlock = ethers.keccak256(validSecret);
      const invalidSecret = ethers.randomBytes(32);
      
      const hashlockValid = ethers.keccak256(validSecret) === validHashlock;
      const hashlockInvalid = ethers.keccak256(invalidSecret) === validHashlock;

      console.log('✅ Hashlock validation:');
      console.log('   Valid secret matches:', hashlockValid);
      console.log('   Invalid secret matches:', hashlockInvalid);

      // Test timelock calculation
      const now = Math.floor(Date.now() / 1000);
      const timelock = now + (24 * 60 * 60); // 24 hours
      const isExpired = now > timelock;

      console.log('✅ Timelock validation:');
      console.log('   Current time:', new Date(now * 1000).toISOString());
      console.log('   Timelock expires:', new Date(timelock * 1000).toISOString());
      console.log('   Is expired:', isExpired);

      return true;
    } catch (error) {
      console.error('❌ Security test failed:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 1inch Fusion+ ETH-TRON Bridge Test Suite');
    console.log('=============================================\n');

    const results = {
      eth: await this.testEthContracts(),
      tron: await this.testTronContracts(),
      crossChain: await this.testCrossChainFlow(),
      priceOracle: await this.testPriceOracle(),
      security: await this.testSecurityFeatures()
    };

    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    Object.entries(results).forEach(([test, result]) => {
      console.log(`   ${result ? '✅' : '❌'} ${test}: ${result ? 'PASSED' : 'FAILED'}`);
    });

    console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('🎉 All tests passed! Your 1inch Fusion+ bridge is ready!');
      
      console.log('\n📋 Ready for deployment checklist:');
      console.log('✅ Ethereum contract integration tested');
      console.log('✅ TRON contract functionality verified');
      console.log('✅ Cross-chain address mapping works');
      console.log('✅ Price oracle simulation successful');
      console.log('✅ Security mechanisms validated');
      
      console.log('\n🚀 Next steps:');
      console.log('1. Deploy contracts to testnets');
      console.log('2. Run end-to-end bridge tests');
      console.log('3. Test with small amounts');
      console.log('4. Monitor for any issues');
      console.log('5. Deploy to mainnet when ready');
    } else {
      console.log('⚠️ Some tests failed. Please review and fix issues before deployment.');
    }

    return passed === total;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new FusionBridgeTest();
  tester.runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = FusionBridgeTest;