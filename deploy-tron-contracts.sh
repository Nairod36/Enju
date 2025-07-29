#!/bin/bash

# Deploy Tron contracts for 1inch Fusion+ Bridge
echo "🚀 Deploying Tron Bridge Contracts..."

# Check if TronBox is installed
if ! command -v tronbox &> /dev/null; then
    echo "❌ TronBox not found. Installing..."
    npm install -g tronbox
fi

# Create Tron project structure
mkdir -p tron-contracts/contracts
mkdir -p tron-contracts/migrations
mkdir -p tron-contracts/test

# Create TronBox configuration
cat > tron-contracts/tronbox.js << EOF
module.exports = {
  networks: {
    mainnet: {
      // Don't put your private key here:
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1e8,
      fullHost: "https://api.trongrid.io",
      network_id: "1"
    },
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 50,
      feeLimit: 1e8,
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2"
    },
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1e8,
      fullHost: "https://nile.trongrid.io",
      network_id: "3"
    },
    development: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 0,
      feeLimit: 1e8,
      fullHost: "http://127.0.0.1:9090",
      network_id: "9"
    },
    compilers: {
      solc: {
        version: "0.8.19"
      }
    }
  },
  // if you are use tronide to debug, you must set useZeroFeeContract=true
  useZeroFeeContract: true
};
EOF

# Copy contract to TronBox structure
cp tron-contracts/TronDirectBridge.sol tron-contracts/contracts/

# Create migration file
cat > tron-contracts/migrations/2_deploy_contracts.js << EOF
const TronDirectBridge = artifacts.require("TronDirectBridge");

module.exports = function(deployer) {
  deployer.deploy(TronDirectBridge);
};
EOF

# Create package.json for Tron contracts
cat > tron-contracts/package.json << EOF
{
  "name": "tron-fusion-bridge",
  "version": "1.0.0",
  "description": "Tron contracts for 1inch Fusion+ Bridge",
  "scripts": {
    "compile": "tronbox compile",
    "migrate": "tronbox migrate",
    "migrate:shasta": "tronbox migrate --network shasta",
    "migrate:mainnet": "tronbox migrate --network mainnet",
    "test": "tronbox test"
  },
  "dependencies": {
    "tronweb": "^5.3.2"
  },
  "devDependencies": {
    "tronbox": "^2.7.24"
  }
}
EOF

# Navigate to tron-contracts directory
cd tron-contracts

# Install dependencies
echo "📦 Installing Tron dependencies..."
npm install

# Compile contracts
echo "🔨 Compiling Tron contracts..."
npm run compile

# Deploy to Shasta testnet (if private key is set)
if [ ! -z "$TRON_PRIVATE_KEY" ]; then
    echo "🚀 Deploying to Tron Shasta testnet..."
    npm run migrate:shasta
    
    echo "✅ Tron contracts deployed successfully!"
    echo "📋 Contract addresses saved in build/contracts/"
else
    echo "⚠️  TRON_PRIVATE_KEY not set. Skipping deployment."
    echo "   Set TRON_PRIVATE_KEY environment variable to deploy contracts."
fi

echo "🎉 Tron integration setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set TRON_PRIVATE_KEY environment variable"
echo "2. Run: cd tron-contracts && npm run migrate:shasta"
echo "3. Update config.json with deployed contract address"
echo "4. Test the bridge with: npm run test"