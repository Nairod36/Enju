#!/bin/bash

# 1inch Fusion+ Cross-Chain Setup - Mainnet Fork
# Addresses the testnet issues mentioned in Discord

echo "🔧 Setting up Ethereum Mainnet Fork for 1inch Testing..."

# Configuration
RPC_URL=${MAINNET_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/7Va8eLLlBZzvliU2gslSL"}
FORK_PORT=${FORK_PORT:-8545}
FORK_BLOCK=${FORK_BLOCK:-"latest"}

# Official 1inch addresses on mainnet
ESCROW_FACTORY="0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a"
LIMIT_ORDER_PROTOCOL="0x11431433B0a05e9f3c0Bb99F1E37Be6f9073c6f3"

echo "📋 Configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Fork Port: $FORK_PORT"
echo "  Fork Block: $FORK_BLOCK"
echo "  EscrowFactory: $ESCROW_FACTORY"
echo "  LimitOrderProtocol: $LIMIT_ORDER_PROTOCOL"

# Check if anvil is installed
if ! command -v anvil &> /dev/null; then
    echo "❌ Anvil not found. Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
fi

# Kill any existing anvil processes
echo "🧹 Cleaning up existing processes..."
pkill anvil 2>/dev/null || true
lsof -ti:$FORK_PORT | xargs kill 2>/dev/null || true

# Start mainnet fork
echo "🚀 Starting Ethereum mainnet fork..."
anvil \
    --fork-url $RPC_URL \
    --fork-block-number $FORK_BLOCK \
    --port $FORK_PORT \
    --host 0.0.0.0 \
    --accounts 10 \
    --balance 10000 \
    --gas-limit 30000000 \
    --code-size-limit 50000 \
    --chain-id 31337 &

ANVIL_PID=$!
echo "📝 Anvil PID: $ANVIL_PID"

# Wait for anvil to start
echo "⏳ Waiting for fork to initialize..."
sleep 5

# Verify fork is working
echo "🔍 Verifying fork setup..."
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:$FORK_PORT)

if [[ $RESPONSE == *"result"* ]]; then
    echo "✅ Fork is running successfully!"
    BLOCK_NUMBER=$(echo $RESPONSE | grep -o '"result":"[^"]*' | cut -d'"' -f4)
    BLOCK_DECIMAL=$((16#${BLOCK_NUMBER:2}))
    echo "   Current block: $BLOCK_DECIMAL"
else
    echo "❌ Fork failed to start"
    kill $ANVIL_PID 2>/dev/null
    exit 1
fi

# Verify 1inch contracts exist on fork
echo "🔍 Verifying 1inch contracts on fork..."

# Check EscrowFactory
CODE_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$ESCROW_FACTORY\",\"latest\"],\"id\":1}" \
    http://localhost:$FORK_PORT)

if [[ $CODE_RESPONSE == *'"result":"0x"'* ]]; then
    echo "❌ EscrowFactory not found at $ESCROW_FACTORY"
    echo "   This might indicate an issue with the fork or contract address"
else
    echo "✅ EscrowFactory verified at $ESCROW_FACTORY"
fi

# Check LimitOrderProtocol
CODE_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$LIMIT_ORDER_PROTOCOL\",\"latest\"],\"id\":1}" \
    http://localhost:$FORK_PORT)

if [[ $CODE_RESPONSE == *'"result":"0x"'* ]]; then
    echo "❌ LimitOrderProtocol not found at $LIMIT_ORDER_PROTOCOL"
else
    echo "✅ LimitOrderProtocol verified at $LIMIT_ORDER_PROTOCOL"
fi

# Set environment variables for scripts
export MAINNET_FORK_URL="http://localhost:$FORK_PORT"
export ESCROW_FACTORY_ADDRESS=$ESCROW_FACTORY
export LIMIT_ORDER_PROTOCOL_ADDRESS=$LIMIT_ORDER_PROTOCOL

echo ""
echo "🎉 Mainnet fork setup complete!"
echo ""
echo "📋 Environment Variables Set:"
echo "   MAINNET_FORK_URL=$MAINNET_FORK_URL"
echo "   ESCROW_FACTORY_ADDRESS=$ESCROW_FACTORY_ADDRESS"
echo "   LIMIT_ORDER_PROTOCOL_ADDRESS=$LIMIT_ORDER_PROTOCOL_ADDRESS"
echo ""
echo "💡 Usage:"
echo "   - Deploy contracts: cd eth-contracts && forge script --rpc-url \$MAINNET_FORK_URL"
echo "   - Run tests: forge test --fork-url \$MAINNET_FORK_URL"
echo "   - Stop fork: kill $ANVIL_PID"
echo ""
echo "⚠️  Note: This fork uses REAL mainnet state, including actual 1inch contracts"
echo "   as recommended by the 1inch team due to testnet SDK limitations."

# Save PID for cleanup
echo $ANVIL_PID > /tmp/anvil.pid
echo "📝 Anvil PID saved to /tmp/anvil.pid for cleanup"