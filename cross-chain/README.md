# 🌉 Cross-Chain ETH ↔ NEAR (1inch Style)

Simple cross-chain resolver using smart contracts directly (no API dependencies).

## 🚀 Quick Start

### 1. Install & Setup
```bash
npm install
cp .env.example .env
```

### 2. Start Local Mainnet Fork (Optional)
```bash
# Add your Alchemy key first:
export MAINNET_RPC_URL='https://eth-mainnet.g.alchemy.com/v2/your-key'

# Start fork (gives access to real 1inch contracts)
./scripts/start-fork.sh
```

### 3. Run the Resolver
```bash
# Basic run (will fail without fork)
npm run dev

# With example swap
npm run dev -- --example
```

## 🎯 What This Does

1. **ETH → NEAR Swap Flow:**
   - Generate HTLC secret & hashlock
   - Create HTLC on Ethereum (locks ETH)
   - Create HTLC on NEAR (locks NEAR equivalent)
   - User can reveal secret to claim both sides

2. **Smart Contracts Only:**
   - No 1inch API dependencies
   - Direct contract interactions
   - Works with mainnet fork (real 1inch contracts)

## 🔧 Architecture

```
Ethereum Client ←→ Cross-Chain Resolver ←→ NEAR Client
      ↓                     ↓                   ↓
   HTLC.sol            Orchestrator       htlc-near.rs
   (Mainnet Fork)      (TypeScript)       (NEAR Testnet)
```

## 📝 Configuration

Edit `.env`:
```env
# For local testing (with fork)
ETH_RPC_URL=http://127.0.0.1:8545
ETH_CHAIN_ID=1

# For NEAR testnet
NEAR_NETWORK_ID=testnet
NEAR_ACCOUNT_ID=your-account.testnet
```

## 🧪 Testing

```bash
# Test with mock data (no fork needed)
npm run dev

# Test with example swap
npm run dev -- --example

# Test with real fork
./scripts/start-fork.sh &
npm run dev -- --example
```

## 📋 Status

- ✅ Basic structure (like 1inch cross-chain-resolver-example)
- ✅ ETH client (smart contracts only)  
- ✅ NEAR client (smart contracts only)
- ✅ Cross-chain orchestrator
- ✅ HTLC flow simulation
- 🔄 Mainnet fork setup
- 🔄 Real contract deployment
- 🔄 End-to-end testing

## 💡 Next Steps

1. **Get Alchemy key** → Set `MAINNET_RPC_URL`
2. **Start fork** → `./scripts/start-fork.sh`
3. **Deploy HTLCs** → On fork + NEAR testnet
4. **Test real swap** → ETH ↔ NEAR

**Following Tanner's guidance: Smart contracts directly, fork mainnet, no API dependencies! 🎯**