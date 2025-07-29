# UniteDeFi Cross-Chain Bridge Documentation

## 🌉 Overview

This is a comprehensive cross-chain bridge system that enables trustless atomic swaps between **Ethereum** and **NEAR Protocol** using Hash Time-Locked Contracts (HTLCs) and integration with **1inch Fusion+** infrastructure.

### Key Features

- ✅ **Atomic Swaps**: Guaranteed completion or full refund
- ✅ **1inch Integration**: Uses official 1inch Fusion+ infrastructure  
- ✅ **No Custody**: Bridge never holds user funds
- ✅ **Deterministic Addresses**: CREATE2-based escrow addresses
- ✅ **Real-time Monitoring**: Event-driven coordination
- ✅ **Automatic Timeouts**: Built-in safety mechanisms

---

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ethereum      │    │  Cross-Chain    │    │     NEAR        │
│   Network       │◄──►│   Resolver      │◄──►│   Protocol      │
│                 │    │                 │    │                 │
│ • 1inch Escrows │    │ • Event Monitor │    │ • HTLC Contract │
│ • CrossChain    │    │ • Coordinator   │    │ • Atomic Swaps  │
│   Bridge        │    │ • Secret Mgmt   │    │ • Time Locks    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

1. **Ethereum Side**:
   - 1inch EscrowFactory (official)
   - CrossChainBridge.sol (our contract)
   - InchDirectBridge.sol (1inch integration)

2. **NEAR Side**:
   - HTLC smart contract (lib.rs)
   - Cross-chain coordination logic

3. **Bridge Resolver**:
   - Event monitoring service
   - Secret coordination
   - Atomic swap orchestration

---

## 📂 Project Structure

```
UniteDeFi-Mokuen/
├── cross-chain/              # TypeScript bridge resolver
│   ├── src/
│   │   ├── inch-fusion-resolver.ts    # 🔥 Main 1inch integration
│   │   ├── near-client.ts             # NEAR blockchain client
│   │   ├── ethereum-client.ts         # Ethereum blockchain client
│   │   ├── types.ts                   # TypeScript interfaces
│   │   └── utils.ts                   # Utility functions
│   └── package.json
├── eth-contracts/            # Solidity smart contracts
│   ├── src/
│   │   ├── CrossChainBridge.sol       # 🔥 Main bridge contract
│   │   └── InchDirectBridge.sol       # 1inch integration
│   └── foundry.toml
├── near-contracts/           # NEAR smart contracts
│   └── htlc-near/
│       └── src/
│           └── lib.rs                 # 🔥 NEAR HTLC contract
└── frontend/                 # React frontend (optional)
```

---

## 🚀 Quick Start Guide

### Prerequisites

```bash
# Required tools
node >= 18.0.0
npm >= 8.0.0
rust >= 1.70.0
near-cli >= 4.0.0
foundry (forge, cast, anvil)
```

### 1. Install Dependencies

```bash
# Cross-chain resolver
cd cross-chain
npm install

# Ethereum contracts
cd ../eth-contracts
forge install

# NEAR contracts
cd ../near-contracts/htlc-near
cargo build --target wasm32-unknown-unknown --release
```

### 2. Configuration

Create environment configuration:

```typescript
// cross-chain/config.ts
const config: InchFusionTypes.Config = {
  ethereum: {
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    chainId: 1, // or 11155111 for Sepolia testnet
    privateKey: 'YOUR_RESOLVER_PRIVATE_KEY',
    crossChainResolverAddress: '0x...' // Deployed CrossChainBridge address
  },
  near: {
    networkId: 'mainnet', // or 'testnet'
    nodeUrl: 'https://rpc.mainnet.near.org',
    accountId: 'your-resolver.near',
    privateKey: 'ed25519:...',
    contractId: 'htlc-contract.near' // Deployed NEAR contract
  }
};
```

### 3. Deploy Contracts

#### Deploy Ethereum Contracts

```bash
cd eth-contracts

# Deploy to local testnet
anvil &
forge script script/DeployCrossChainBridge.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy to Sepolia testnet
forge script script/DeployCrossChainBridge.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify

# Deploy to mainnet (⚠️ Use with caution)
forge script script/DeployCrossChainBridge.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify
```

#### Deploy NEAR Contracts

```bash
cd near-contracts/htlc-near

# Build contract
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
near dev-deploy --wasmFile target/wasm32-unknown-unknown/release/htlc_near.wasm

# Deploy to mainnet
near deploy --wasmFile target/wasm32-unknown-unknown/release/htlc_near.wasm --accountId your-contract.near
```

### 4. Start the Bridge Resolver

```bash
cd cross-chain
npm run start

# Or with specific config
npm run start -- --config ./config/mainnet.json
```

---

## 💡 Usage Examples

### Basic ETH → NEAR Swap

```typescript
import { InchFusionResolver } from './src/inch-fusion-resolver';

// Initialize resolver
const resolver = new InchFusionResolver(config);
await resolver.initialize();

// Process ETH to NEAR swap
const swapResult = await resolver.processEthToNearSwap({
  secretHash: '0x1234567890abcdef...', // 32-byte hash
  timelock: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  nearAccount: 'alice.near',
  ethRecipient: '0xAbc123...',
  amount: '1000000000000000000' // 1 ETH in wei
});

console.log('Swap result:', swapResult);
```

### Basic NEAR → ETH Swap

```typescript
// Process NEAR to ETH swap
const swapResult = await resolver.processNearToEthSwap({
  secretHash: '0x1234567890abcdef...', // Same 32-byte hash
  timelock: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  ethRecipient: '0xAbc123...',
  amount: '1000000000000000000000000' // 1 NEAR in yoctoNEAR
});

console.log('Swap result:', swapResult);
```

### Advanced: Custom Secret Management

```typescript
import { createHash, randomBytes } from 'crypto';

// Generate secret and hash
const secret = randomBytes(32);
const secretHash = '0x' + createHash('sha256').update(secret).digest('hex');

console.log('Secret:', secret.toString('hex'));
console.log('Hash:', secretHash);

// Use in swap
const swapResult = await resolver.processEthToNearSwap({
  secretHash,
  timelock: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
  nearAccount: 'alice.near',
  ethRecipient: '0xAbc123...',
  amount: '1000000000000000000'
});
```

---

## 🔧 Configuration Reference

### Ethereum Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `rpcUrl` | Ethereum JSON-RPC endpoint | `https://eth-mainnet.g.alchemy.com/v2/key` |
| `chainId` | Network ID (1=mainnet, 11155111=Sepolia) | `1` |
| `privateKey` | Resolver wallet private key | `0x1234...` |
| `crossChainResolverAddress` | Deployed bridge contract | `0xAbc123...` |

### NEAR Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `networkId` | NEAR network | `mainnet` or `testnet` |
| `nodeUrl` | NEAR RPC endpoint | `https://rpc.mainnet.near.org` |
| `accountId` | Resolver account ID | `resolver.near` |
| `privateKey` | NEAR account private key | `ed25519:...` |
| `contractId` | HTLC contract account | `htlc.resolver.near` |

---

## 🔍 Monitoring and Debugging

### Event Monitoring

The resolver provides comprehensive logging:

```typescript
// Get resolver status
const status = resolver.getStatus();
console.log('Resolver Status:', status);

// Monitor specific events
resolver.on('swapInitiated', (swapId, details) => {
  console.log(`Swap ${swapId} initiated:`, details);
});

resolver.on('swapCompleted', (swapId, secret) => {
  console.log(`Swap ${swapId} completed with secret:`, secret);
});
```

### Common Issues

1. **"EscrowFactory not found"**
   - Check if you're on the correct network
   - Verify the 1inch EscrowFactory address

2. **"Timeout waiting for event"**
   - Increase timeout parameter
   - Check network connectivity
   - Verify transaction was submitted

3. **"Invalid secret"**
   - Ensure secret hashes correctly
   - Check byte order and encoding

4. **"Insufficient balance"**
   - Fund resolver wallet with ETH for gas
   - Fund NEAR account for storage and gas

---

## 🛡️ Security Considerations

### Best Practices

1. **Private Key Management**:
   ```bash
   # Use environment variables
   export RESOLVER_PRIVATE_KEY="0x..."
   export NEAR_PRIVATE_KEY="ed25519:..."
   
   # Or encrypted key stores
   npm install @ethersproject/json-wallets
   ```

2. **Network Verification**:
   ```typescript
   // Always verify network before operations
   const network = await ethProvider.getNetwork();
   if (network.chainId !== expectedChainId) {
     throw new Error('Wrong network!');
   }
   ```

3. **Amount Validation**:
   ```typescript
   // Validate amounts are reasonable
   const maxAmount = ethers.utils.parseEther('10'); // 10 ETH max
   if (amount.gt(maxAmount)) {
     throw new Error('Amount too large');
   }
   ```

### Security Features

- ✅ **No Fund Custody**: Bridge never holds user funds
- ✅ **Atomic Guarantees**: Complete or full refund
- ✅ **Time Locks**: Automatic expiration prevents stuck funds
- ✅ **Cryptographic Verification**: SHA256 hash verification
- ✅ **Reentrancy Protection**: Solidity guards
- ✅ **Access Control**: Authorized resolvers only

---

## 🧪 Testing

### Unit Tests

```bash
# Test Ethereum contracts
cd eth-contracts
forge test

# Test TypeScript resolver
cd cross-chain
npm test

# Test NEAR contracts
cd near-contracts/htlc-near
cargo test
```

### Integration Tests

```bash
# Start local networks
anvil &
near-sandbox &

# Run integration tests
cd cross-chain
npm run test:integration
```

### Manual Testing

```bash
# 1. Start local resolver
npm run start:local

# 2. Create test swap
curl -X POST localhost:3000/api/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromChain": "ethereum",
    "toChain": "near",
    "amount": "1000000000000000000",
    "nearAccount": "test.near"
  }'

# 3. Monitor logs
tail -f logs/resolver.log
```

---

## 📊 Performance Optimization

### Gas Optimization

1. **Batch Operations**:
   ```typescript
   // Batch multiple swaps
   const swaps = await resolver.processBatchSwaps([swap1, swap2, swap3]);
   ```

2. **Gas Price Management**:
   ```typescript
   // Use dynamic gas pricing
   const gasPrice = await ethProvider.getGasPrice();
   const optimizedGas = gasPrice.mul(110).div(100); // 10% buffer
   ```

### Network Optimization

1. **Connection Pooling**:
   ```typescript
   // Use connection pools for better performance
   const provider = new ethers.providers.JsonRpcProvider({
     url: rpcUrl,
     timeout: 30000,
     throttleLimit: 10
   });
   ```

2. **Event Filtering**:
   ```typescript
   // Filter events by block range
   const events = await contract.queryFilter(
     'SwapInitiated',
     fromBlock,
     toBlock
   );
   ```

---

## 🤝 Contributing

### Development Setup

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/awesome-feature`
3. **Install dependencies**: `npm install`
4. **Run tests**: `npm test`
5. **Submit pull request**

### Code Style

```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run type-check
```

### Commit Convention

```bash
git commit -m "feat: add new swap type"
git commit -m "fix: resolve timeout issue"
git commit -m "docs: update API documentation"
```

---

## 📞 Support

### Documentation

- **Smart Contracts**: See `eth-contracts/README.md`
- **NEAR Integration**: See `near-contracts/README.md`
- **API Reference**: See `cross-chain/docs/api.md`

### Community

- **Discord**: [UniteDeFi Discord](https://discord.gg/unitedefi)
- **Telegram**: [@UniteDeFi](https://t.me/unitedefi)
- **GitHub Issues**: [Submit Issues](https://github.com/Nairod36/UniteDeFi-Mokuen/issues)

### Team Contact

- **Security Issues**: security@unitedefi.io
- **Technical Support**: dev@unitedefi.io
- **Business Inquiries**: hello@unitedefi.io

---

## 📄 License

This project is licensed under the MIT License. See `LICENSE` file for details.

---

## ⚡ Quick Reference

### Essential Commands

```bash
# Start resolver
npm run start

# Deploy contracts
forge script script/Deploy.s.sol --broadcast

# Run tests
npm test

# Check status
curl localhost:3000/api/status

# Monitor logs
tail -f logs/resolver.log
```

### Key Addresses

- **1inch EscrowFactory**: `0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a`
- **Ethereum Bridge**: `0x...` (deployed address)
- **NEAR Contract**: `htlc.unitedefi.near`

### Important Links

- **1inch Fusion+ Docs**: https://docs.1inch.io/docs/fusion-plus/
- **NEAR Protocol Docs**: https://docs.near.org/
- **Ethereum Docs**: https://ethereum.org/developers/

---

*Built with ❤️ by the UniteDeFi Team*
