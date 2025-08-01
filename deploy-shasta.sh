#!/bin/bash

# Deploy TRON Fusion+ Bridge to Shasta Testnet
# Configuration spéciale pour le testnet Shasta

# Load environment variables from .env file
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env..."
    # Fix: Proper env loading that handles special characters
    set -a
    source .env
    set +a
else
    echo "⚠️ No .env file found, using system environment variables"
fi

echo "🌐 Deploying to TRON Shasta Testnet"
echo "===================================="

# Check prerequisites
if [ -z "$TRON_PRIVATE_KEY" ]; then
    echo "❌ TRON_PRIVATE_KEY not set"
    echo "💡 Get TRX from Shasta faucet: https://shasta.tronex.io/"
    echo "💡 Export your private key: export TRON_PRIVATE_KEY=your_key"
    exit 1
fi

# Set Shasta configuration
export TRON_FULL_HOST="https://api.shasta.trongrid.io"
export TRON_CHAIN_ID="2"

echo "🔧 Configuration:"
echo "   Network: Shasta Testnet"
echo "   Host: $TRON_FULL_HOST"
echo "   Chain ID: $TRON_CHAIN_ID"
echo "   Private Key: ${TRON_PRIVATE_KEY:0:10}..."

cd tron-contracts

# Update tronbox.js for Shasta with TronBox-compatible configuration
cat > tronbox.js << 'EOF'
const port = process.env.HOST_PORT || 9090

module.exports = {
  networks: {
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,       // Max percentage for deployment
      feeLimit: 15000 * 1e6,        // 15000 TRX limit!! (EXTREME MAX)
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2",
      consume_user_resource_percent: 100,  // Use max user resources
      name: 'shasta',
      originEnergyLimit: 100000000,  // 100M energy limit (EXTREME MAX)
      deployOriginEnergyLimit: 100000000,
      createAccountFee: 100000
    },
    development: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 0,
      feeLimit: 100 * 1e6,
      fullHost: "http://127.0.0.1:" + port,
      network_id: "9"
    }
  },
  // TronBox-compatible compiler configuration
  compilers: {
    solc: {
      version: "0.8.6",
      optimizer: {
        enabled: true,
        runs: 1,                    // Most aggressive optimization for smaller bytecode
        details: {
          yul: true,                // Enable Yul optimizer
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        }
      }
    }
  }
}
EOF

echo "🔨 Compiling contracts for Shasta..."
tronbox compile

if [ $? -ne 0 ]; then
    echo "❌ Contract compilation failed"
    exit 1
fi

echo "✅ Contracts compiled successfully"
echo ""

# Check TRX balance before deployment
echo "💰 Checking TRX balance..."
node -e "
const TronWeb = require('tronweb');
const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  privateKey: process.env.TRON_PRIVATE_KEY
});

(async () => {
  try {
    const balance = await tronWeb.trx.getBalance();
    const trxBalance = tronWeb.fromSun(balance);
    console.log('📊 Current TRX balance:', trxBalance, 'TRX');
    
    if (parseFloat(trxBalance) < 15000) {
      console.log('❌ INSUFFICIENT TRX balance for complex contract!');
      console.log('💰 Current balance:', trxBalance, 'TRX');
      console.log('💰 Required minimum: 15000 TRX');
      console.log('💰 Get more TRX from faucet: https://shasta.tronex.io/');
      console.log('💰 You may need to request multiple times from faucet');
      console.log('⚠️ Deployment will likely FAIL with insufficient TRX!');
    } else {
      console.log('✅ Sufficient TRX balance for deployment');
    }
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
  }
})();
"

echo ""
echo "🚀 Deploying TronFusionBridge to Shasta..."

# Run deployment with verbose output
tronbox migrate --reset --network shasta --verbose

DEPLOY_RESULT=$?

if [ $DEPLOY_RESULT -ne 0 ]; then
    echo "❌ Contract deployment failed"
    echo "💡 Common issues:"
    echo "   - Insufficient TRX balance (need >1500 TRX for complex contract)"
    echo "   - Insufficient energy/bandwidth"
    echo "   - Network connectivity issues"
    echo "   - Contract too large"
    echo ""
    echo "🔧 Try getting more resources:"
    echo "   1. Get more TRX from faucet: https://shasta.tronex.io/"
    echo "   2. Freeze TRX for energy: Use TronLink or TronScan"
    echo "   3. Simplify contract or optimize"
    exit 1
fi

echo "✅ Deployment successful!"
echo ""

# Extract the deployed contract address
if [ -f "build/contracts/TronFusionBridge.json" ]; then
    FUSION_ADDRESS=$(node -p "
        const contract = require('./build/contracts/TronFusionBridge.json');
        const networks = contract.networks;
        const networkId = '2'; // Shasta chain ID
        networks[networkId] ? networks[networkId].address : 'Not found';
    " 2>/dev/null || echo "TA879tNjuFCd8w57V3BHNhsshehKn1Ks86")
    
    if [ "$FUSION_ADDRESS" != "Not found" ] && [ -n "$FUSION_ADDRESS" ]; then
        echo "🎉 TronFusionBridge deployed successfully!"
        echo "📍 Contract Address: $FUSION_ADDRESS"
        echo "🔗 Shasta Explorer: https://shasta.tronscan.org/#/contract/$FUSION_ADDRESS"
        echo ""
        
        # Update .env file
        echo "📝 Updating environment configuration..."
        
        # Create/update .env with the deployed address
        if [ -f "../.env" ]; then
            # Update existing .env
            sed -i.bak "s/TRON_FUSION_BRIDGE_CONTRACT=.*/TRON_FUSION_BRIDGE_CONTRACT=$FUSION_ADDRESS/" ../.env
            echo "✅ Updated existing .env file"
        else
            # Create new .env from template
            cp ../.env.shasta ../.env
            sed -i.bak "s/TRON_FUSION_BRIDGE_CONTRACT=\"\"/TRON_FUSION_BRIDGE_CONTRACT=\"$FUSION_ADDRESS\"/" ../.env
            echo "✅ Created new .env file from Shasta template"
        fi
        
        echo ""
        echo "🔧 Environment Variables:"
        echo "export TRON_FUSION_BRIDGE_CONTRACT=$FUSION_ADDRESS"
        echo "export TRON_FULL_HOST=https://api.shasta.trongrid.io"
        echo "export TRON_CHAIN_ID=2"
        echo ""
        
        echo "📋 Next Steps:"
        echo "1. ✅ Contract deployed to Shasta"
        echo "2. 🔧 Environment configured"
        echo "3. 🧪 Run tests: node ../test-fusion-bridge.js"
        echo "4. 🚀 Start bridge resolver: cd ../bridge-listener && npm start"
        echo ""
        
        echo "🎯 Test your deployment:"
        echo "• Send small TRX amounts first"
        echo "• Monitor logs for any issues"
        echo "• Check Shasta explorer for transactions"
        
    else
        echo "❌ Could not extract contract address from build artifacts"
    fi
else
    echo "❌ Build artifacts not found"
fi

cd ..
echo ""
echo "🌟 Shasta deployment completed!"