# 1inch Cross-Chain Swap (Fusion+) Extension for ETH ↔ NEAR - Demo Guide

## 🚀 Quick Demo (1-Click Setup)

### Option 1: Full 1inch Fusion+ Demo (Recommended)
```bash
# Complete demo with mainnet fork
node scripts/demo-1inch-fusion.js
```

### Option 2: Manual Setup
```bash
# 1. Setup mainnet fork (addresses testnet limitations)
scripts/setup-mainnet-fork.sh   # Linux/Mac
scripts/setup-mainnet-fork.bat  # Windows

# 2. Deploy contracts
node scripts/deploy-cross-chain.js

# 3. Run resolver demo
cd cross-chain && node src/index.ts --demo
```

### ⚠️ Important Notes
- **Testnets don't work** with 1inch SDK (per Discord guidance)
- **Mainnet fork required** for testing with real 1inch contracts
- **Official EscrowFactory** (`0xa7bcb4...`) is used automatically

---

## 🎯 What This Demo Shows

### ✅ **1inch Fusion+ Core Requirements**
- [x] **Bidirectional Swaps**: ETH ↔ NEAR atomic swaps in both directions
- [x] **Hashlock/Timelock**: SHA256 + timestamp preservation for non-EVM
- [x] **Onchain Execution**: Mainnet/testnet ready smart contracts
- [x] **1inch Integration**: Built on cross-chain-swap infrastructure

### 🚀 **1inch Integration Features**
- [x] **Official Escrow Factory**: Uses 1inch battle-tested contracts (0xa7bcb4...)
- [x] **Resolver Authorization**: Authorized resolver system for secure execution
- [x] **Cross-Chain Coordination**: Seamless NEAR ↔ ETH atomic swaps
- [x] **Emergency Recovery**: Owner-controlled emergency functions

---

## 📋 Demo Scenarios

### Scenario 1: ETH → NEAR Swap
1. **Setup**: User connects wallet, initiates cross-chain swap
2. **1inch Escrow**: Creates EscrowSrc using official 1inch factory (0xa7bcb4...)
3. **Hashlock/Timelock**: SHA256 secret with 24h timelock for security
4. **NEAR HTLC**: Corresponding NEAR contract with matching parameters
5. **Atomic Completion**: Secret reveals unlock both sides simultaneously
6. **Settlement**: Tokens transferred atomically or fully reverted

### Scenario 2: NEAR → ETH Swap
1. **NEAR Lock**: User locks NEAR tokens in cross-chain HTLC
2. **ETH Coordination**: Resolver coordinates with 1inch infrastructure
3. **Secret Coordination**: Same hashlock used on both chains
4. **Atomic Settlement**: Success or complete reversion guaranteed

---

## 🔧 Technical Architecture

### Smart Contracts
```
📁 eth-contracts/src/
├── HTLC.sol                    # Original HTLC implementation
├── InchCrossChainResolver.sol  # 1inch Fusion+ cross-chain resolver
└── test/                      # Comprehensive test suite
    ├── HTLC.t.sol
    └── InchCrossChainResolver.t.sol
```

### Cross-Chain Resolver
```
📁 cross-chain/src/
├── resolver.ts        # Main orchestration logic
├── ethereum-client.ts # ETH blockchain interface
├── near-client.ts     # NEAR blockchain interface
└── types.ts          # TypeScript definitions
```

### NEAR Contracts
```
📁 near-contracts/htlc-near/src/
└── lib.rs            # Rust HTLC with equivalent security
```

### User Interface
```
📁 frontend/src/components/
├── CrossChainSwap.tsx # Main swap interface
├── ui/               # Reusable UI components
└── pages/            # Application pages
```

---

## 🎮 Gamification Features

### Forest Ecosystem
- **Every swap grows your virtual forest**
- **Blockchain-specific creatures**: 🦊 NEAR Fox, ⟠ ETH Dragon
- **LEAF token economy** for creature evolution
- **Progressive unlocks** of rare plants and animals

### User Experience
- **Dutch Auction Visualization**: Real-time price charts
- **Swap Progress Tracking**: Visual HTLC states
- **Multi-Chain Wallet Integration**: Seamless ETH + NEAR
- **Reward Animations**: Gamified feedback system

---

## 🔍 Testing & Verification

### Contract Testing
```bash
# Run all smart contract tests
cd eth-contracts && forge test -vv

# Specific test scenarios
forge test --match-test testCreateHTLC
forge test --match-test testWithdraw
forge test --match-test testRefund
```

### Integration Testing
```bash
# Test cross-chain resolver
cd cross-chain && npm test

# Test with mainnet fork
./scripts/start-fork.sh &
node scripts/demo-complete.js
```

### UI Testing
```bash
# Start frontend development server
cd frontend && npm run dev

# Access at http://localhost:5173
# Test swap flows with MetaMask + NEAR wallet
```

---

## 🏆 Why This Implementation Wins

### **Technical Excellence**
- **Full 1inch Compliance**: Meets all requirements + stretch goals
- **Production Ready**: Real contracts, atomic swaps, economic incentives
- **Innovation**: Dutch auction + gamification first in cross-chain space

### **User Experience**
- **Intuitive Design**: Complex DeFi made simple and visual
- **Educational Value**: Teaches cross-chain concepts through gameplay
- **Sustainable Engagement**: Forest ecosystem creates retention

### **Ecosystem Impact**
- **NEAR Integration**: Brings 1inch liquidity to NEAR Protocol
- **Resolver Network**: Creates professional cross-chain execution layer
- **Open Source**: Fully auditable, extensible architecture

---

## 🛠️ Troubleshooting

### Common Issues

**1. Forge not found**
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**2. Anvil port conflicts**
```bash
# Kill existing processes
pkill anvil
lsof -ti:8545 | xargs kill
```

**3. NEAR contract deployment**
```bash
# Install NEAR CLI
npm install -g near-cli
near login
```

**4. Frontend dependencies**
```bash
cd frontend
npm install
npm run dev
```

---

## 📞 Support & Resources

- **Code Repository**: [All source code with detailed comments]
- **Demo Video**: [Recording of complete swap flow]
- **Technical Documentation**: [Architecture and implementation details]
- **1inch Fusion+ Reference**: [Official cross-chain resolver example]

**🎯 This implementation showcases how 1inch Fusion+ can be extended with innovative UX to make cross-chain DeFi accessible, engaging, and fun for everyone!**