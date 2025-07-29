#!/bin/bash

echo "🌐 Setting up NEAR for Cross-Chain Demo"
echo "======================================"

# Check if NEAR CLI is installed
if ! command -v near &> /dev/null; then
    echo "📦 Installing NEAR CLI..."
    npm install -g near-cli
fi

# Check if account exists
if [ ! -d ".near-credentials" ]; then
    echo ""
    echo "🔑 NEAR Account Setup Required"
    echo "1. Go to: https://wallet.testnet.near.org/"
    echo "2. Create account: cross-chain-demo.testnet"
    echo "3. Run: near login"
    echo "4. Run this script again"
    echo ""
    exit 1
fi

# Build NEAR contract
echo "🔨 Building NEAR HTLC contract..."
cd ../near-contracts

if [ ! -f "Cargo.toml" ]; then
    echo "❌ NEAR contract source not found"
    echo "Creating basic HTLC contract..."
    
    # Create basic Rust contract
    mkdir -p src
    cat > Cargo.toml << EOF
[package]
name = "htlc-near"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
near-sdk = "4.1.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
codegen-units = 1
opt-level = "z"
lto = true
debug = false
panic = "abort"
overflow-checks = true
EOF

    cat > src/lib.rs << 'EOF'
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, Timestamp,
};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCContract {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub hashlock: String,
    pub timelock: Timestamp,
    pub withdrawn: bool,
    pub refunded: bool,
    pub eth_address: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct HTLCNear {
    contracts: UnorderedMap<String, HTLCContract>,
}

#[near_bindgen]
impl HTLCNear {
    #[init]
    pub fn new() -> Self {
        Self {
            contracts: UnorderedMap::new(b"c"),
        }
    }

    #[payable]
    pub fn create_htlc(
        &mut self,
        receiver: AccountId,
        hashlock: String,
        timelock: Timestamp,
        eth_address: String,
    ) -> String {
        let sender = env::predecessor_account_id();
        let amount = env::attached_deposit();
        let contract_id = format!("{}-{}", sender, env::block_timestamp());
        
        let htlc = HTLCContract {
            sender,
            receiver,
            amount: U128(amount),
            hashlock,
            timelock,
            withdrawn: false,
            refunded: false,
            eth_address,
        };
        
        self.contracts.insert(&contract_id, &htlc);
        contract_id
    }

    pub fn withdraw(&mut self, contract_id: String, preimage: String) {
        let mut htlc = self.contracts.get(&contract_id).expect("Contract not found");
        
        assert!(!htlc.withdrawn, "Already withdrawn");
        assert!(!htlc.refunded, "Already refunded");
        assert_eq!(htlc.receiver, env::predecessor_account_id(), "Not receiver");
        assert!(env::block_timestamp() <= htlc.timelock, "Timelock expired");
        
        // Verify hashlock (simplified)
        let hash = env::sha256(preimage.as_bytes());
        let hash_hex = hex::encode(hash);
        assert_eq!(htlc.hashlock, hash_hex, "Invalid preimage");
        
        htlc.withdrawn = true;
        self.contracts.insert(&contract_id, &htlc);
        
        Promise::new(htlc.receiver).transfer(htlc.amount.0);
    }

    pub fn get_contract(&self, contract_id: String) -> Option<HTLCContract> {
        self.contracts.get(&contract_id)
    }
}
EOF
fi

# Build contract
echo "🔨 Building WASM..."
RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release

if [ -f "target/wasm32-unknown-unknown/release/htlc_near.wasm" ]; then
    cp target/wasm32-unknown-unknown/release/htlc_near.wasm htlc.wasm
    echo "✅ NEAR contract built successfully!"
else
    echo "❌ Build failed"
    exit 1
fi

cd ../cross-chain
echo "🎉 NEAR setup complete! Run: node scripts/deploy-near.js"