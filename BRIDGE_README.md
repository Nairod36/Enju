# 🌉 Enju Cross-Chain Bridge

**ETH ↔ NEAR Cross-Chain Bridge using 1inch Fusion+ Technology**

## Overview

Enju Bridge enables seamless token transfers between Ethereum and NEAR Protocol using 1inch Fusion+ cross-chain swap infrastructure with Hash Time Locked Contracts (HTLC).

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ethereum      │    │  Cross-Chain     │    │      NEAR       │
│   Mainnet       │◄──►│   Resolver       │◄──►│    Protocol     │
│                 │    │                  │    │                 │
│ InchResolver.sol│    │ 1inch Fusion+    │    │  HTLCNear.rs    │
│ EscrowFactory   │    │ TypeScript       │    │  Rust Contract  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │   React Frontend │
                    │   (Wagmi + NEAR) │
                    └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥18.0.0
- **Foundry** (forge, anvil, cast)
- **Rust** & Cargo
- **NEAR CLI**

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/enju-bridge.git
cd enju-bridge
chmod +x *.sh

# Terminal 1: Start mainnet fork
./start-mainnet-fork.sh

# Terminal 2: Start bridge
./start-bridge.sh
```

**That's it!** The bridge will be available at http://localhost:5173

### Custom RPC (Optional)

To use your own RPC endpoint instead of the free public one:

```bash
# Set your RPC URL (Alchemy, Infura, etc.)
export ETH_RPC_URL="https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY"

# Then start normally
./start-mainnet-fork.sh
```

## 📝 Configuration

### Ethereum Setup (.env)
```bash
# eth-contracts/.env
PRIVATE_KEY=0x...
RPC_URL=http://localhost:8545
CHAIN_ID=1
```

### NEAR Setup (config.json)
```json
{
  "near": {
    "networkId": "testnet",
    "nodeUrl": "https://rpc.testnet.near.org",
    "accountId": "your-account.testnet",
    "contractId": "htlc-bridge.testnet"
  }
}
```

## 🌉 How to Bridge

### ETH → NEAR

1. **Connect Wallet** - MetaMask for Ethereum
2. **Enter Amount** - Amount of ETH to bridge
3. **Confirm Transaction** - Creates HTLC on Ethereum
4. **Wait for Confirmation** - Resolver creates NEAR HTLC
5. **Complete** - Tokens arrive on NEAR

### NEAR → ETH

1. **Connect NEAR Wallet** 
2. **Create HTLC** - Lock NEAR tokens
3. **Resolver Action** - Creates Ethereum escrow
4. **Complete Swap** - ETH arrives on Ethereum

## 🏗️ Development

### Project Structure

```
enju-bridge/
├── eth-contracts/          # Solidity contracts
│   ├── src/InchCrossChainResolver.sol
│   ├── script/DeployInchHTLC.s.sol
│   └── test/
├── near-contracts/         # Rust contracts
│   └── htlc-near/
│       └── src/lib.rs
├── cross-chain/           # TypeScript resolver
│   ├── src/inch-fusion-resolver.ts
│   └── src/types.ts
├── frontend/              # React frontend
│   └── src/pages/app/AppDashboard.tsx
└── scripts/              # Deployment scripts
```

### Commands

```bash
# Development
npm run dev                # Start all services
npm run stop              # Stop all services

# Building
npm run build             # Build all components
npm run build:eth         # Build Ethereum contracts
npm run build:near        # Build NEAR contracts

# Testing
npm run test              # Run all tests
npm run test:eth          # Test Ethereum contracts
npm run test:near         # Test NEAR contracts

# Deployment
npm run deploy:eth        # Deploy Ethereum contracts
npm run deploy:near       # Deploy NEAR contracts
```

## 🔧 Technical Details

### 1inch Integration

- **EscrowFactory**: `0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a`
- **Cross-Chain Resolver**: Custom contract integrating with 1inch
- **HTLC Protocol**: SHA256 hashlocks with timelocks

### Security Features

- ✅ **Time-locked contracts** - Auto-refund after expiration
- ✅ **Hash verification** - Cryptographic proof of payment
- ✅ **Multi-signature** - Authorized resolvers only
- ✅ **Emergency functions** - Owner controls for safety

### Gas Optimization

- ✅ **Minimal proxy pattern** - Reduced deployment costs
- ✅ **Batch operations** - Multiple swaps in one transaction
- ✅ **Efficient storage** - Optimized struct packing

## 🧪 Testing

### Local Testing

```bash
# Start local environment
./start-bridge.sh

# Run integration tests
npm run test

# Test specific components
cd eth-contracts && forge test -vvv
cd near-contracts && cargo test
```

### Testnet Testing

1. **Ethereum Sepolia** - Deploy contracts
2. **NEAR Testnet** - Deploy NEAR contracts  
3. **End-to-End** - Test full bridge flow

## 🚨 Security

### Audits

- [ ] Internal security review
- [ ] External audit pending
- [ ] Bug bounty program planned

### Known Limitations

- **Beta software** - Use with caution
- **Testnet only** - Mainnet deployment pending audit
- **Manual resolver** - Decentralized resolver in development

## 📚 Documentation

- [Architecture Guide](./docs/architecture.md)
- [Integration Guide](./docs/integration.md)
- [API Reference](./docs/api.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Discord**: [Join our community](https://discord.gg/enju)
- **GitHub Issues**: [Report bugs](https://github.com/your-org/enju-bridge/issues)
- **Documentation**: [Read the docs](https://docs.enju.bridge)

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk. Always test on testnets first.