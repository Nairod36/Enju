#!/bin/bash

# Quick script to start Anvil mainnet fork
# This gives us access to real 1inch contracts

echo "🔄 Starting Anvil mainnet fork..."
echo "This will give us access to real 1inch limit order protocol contracts"

# You'll need to add your Alchemy/Infura key here
MAINNET_RPC_URL=${MAINNET_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY_HERE"}

if [[ "$MAINNET_RPC_URL" == *"YOUR_KEY_HERE"* ]]; then
    echo "⚠️  Please set your MAINNET_RPC_URL first:"
    echo "export MAINNET_RPC_URL='https://eth-mainnet.g.alchemy.com/v2/your-actual-key'"
    echo ""
    echo "Or edit this script and replace YOUR_KEY_HERE with your key"
    exit 1
fi

echo "🌐 Forking from: $MAINNET_RPC_URL"
echo "🏠 Local endpoint: http://127.0.0.1:8545"
echo "⚡ Chain ID: 1 (mainnet fork)"
echo ""

# Check if anvil is installed
if ! command -v anvil &> /dev/null; then
    echo "❌ Anvil not found. Please install Foundry first:"
    echo "curl -L https://foundry.paradigm.xyz | bash"
    echo "foundryup"
    exit 1
fi

anvil \
  --fork-url $MAINNET_RPC_URL \
  --fork-block-number 18500000 \
  --chain-id 1 \
  --host 0.0.0.0 \
  --port 8545 \
  --accounts 10 \
  --balance 10000 \
  --gas-limit 30000000 \
  --gas-price 20000000000 \
  --base-fee 7 \
  --block-time 2