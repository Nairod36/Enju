#!/bin/bash

# Build script for NEAR HTLC contract

set -e

echo "Building NEAR HTLC contract..."

cd htlc-near

# Install cargo-near if not already installed
if ! command -v cargo-near &> /dev/null; then
    echo "Installing cargo-near..."
    cargo install cargo-near
fi

# Build the contract
cargo near build

echo "NEAR contract built successfully!"
echo "WASM file located at: target/near/htlc-near.wasm"

# Copy to output directory for easy access
mkdir -p ../build
cp target/near/htlc-near.wasm ../build/

echo "Contract copied to ../build/htlc-near.wasm"