#!/bin/bash

# Deploy script for NEAR HTLC contract

set -e

NETWORK=${1:-testnet}
ACCOUNT_ID=${2:-htlc-near.testnet}

echo "Deploying NEAR HTLC contract to $NETWORK..."
echo "Account ID: $ACCOUNT_ID"

# Check if near CLI is installed
if ! command -v near &> /dev/null; then
    echo "Error: near CLI is not installed. Please install it first:"
    echo "npm install -g near-cli"
    exit 1
fi

# Build the contract first
./build.sh

# Deploy the contract
echo "Deploying contract..."
near deploy \
  --accountId $ACCOUNT_ID \
  --wasmFile build/htlc-near.wasm \
  --networkId $NETWORK

# Initialize the contract
echo "Initializing contract..."
near call $ACCOUNT_ID new \
  '{"owner": "'$ACCOUNT_ID'"}' \
  --accountId $ACCOUNT_ID \
  --networkId $NETWORK

echo "Contract deployed and initialized successfully!"
echo "Contract Account: $ACCOUNT_ID"
echo "Network: $NETWORK"