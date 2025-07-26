#!/bin/bash

# Deployment script for Near HTLC contract

ACCOUNT_ID="fusion-htlc.testnet"  # Change this to your account

echo "🚀 Deploying Fusion HTLC to Near testnet..."

# Build first
./build.sh

# Deploy the contract
echo "📡 Deploying contract to $ACCOUNT_ID..."
near deploy --wasmFile res/fusion_htlc.wasm --accountId $ACCOUNT_ID

# Initialize the contract
echo "🔧 Initializing contract..."
near call $ACCOUNT_ID new '{"owner": "'$ACCOUNT_ID'"}' --accountId $ACCOUNT_ID

echo "✅ Contract deployed and initialized!"
echo ""
echo "🔗 Contract address: $ACCOUNT_ID"
echo ""
echo "📋 Available methods:"
echo "  • initiate_swap"
echo "  • claim_swap" 
echo "  • refund_swap"
echo "  • get_swap"
echo "  • verify_secret"