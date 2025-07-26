#!/bin/bash

# Build script for Near HTLC contract

echo "🔨 Building Fusion HTLC contract for Near..."

# Clean previous builds
cargo clean

# Build the contract
RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release

# Copy the wasm file
mkdir -p res
cp target/wasm32-unknown-unknown/release/fusion_htlc.wasm res/

echo "✅ Contract built successfully!"
echo "📦 WASM file: res/fusion_htlc.wasm"
echo ""
echo "🚀 To deploy on testnet:"
echo "near deploy --wasmFile res/fusion_htlc.wasm --accountId YOUR_ACCOUNT.testnet"