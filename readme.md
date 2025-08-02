# UniteDeFi Bridge - 1inch Fusion+ Multi-Chain Extension

## 🎯 Project Overview

**UniteDeFi Bridge** extends the 1inch Fusion+ protocol to support **ETH ↔ NEAR ↔ TRON** atomic swaps with automatic price conversion using real-time market rates.

### Key Features
- ✅ **Multi-Chain Support**: ETH, NEAR, and TRON integration
- ✅ **Real-Time Price Oracle**: Automatic conversions using CoinGecko/Binance APIs
- ✅ **1inch Infrastructure**: Built on official EscrowFactory (`0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a`)
- ✅ **Atomic Swaps**: HTLC-based with SHA256 hashlock + timelock
- ✅ **Production Ready**: Deployed contracts and working frontend

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ETHEREUM      │    │      NEAR       │    │      TRON       │
│                 │    │                 │    │                 │
│ InchDirectBridge│◄──►│  htlc-near.rs   │    │TronDirectBridge │
│ EscrowFactory   │    │  Cross-chain    │    │ HTLC + Events   │
│ 1inch Fusion+   │    │  HTLC Support   │    │ TRX Handling    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    Price Oracle         │
                    │  - CoinGecko API        │
                    │  - Binance Backup       │
                    │  - 30s Cache            │
                    │  - Auto Conversions     │
                    └─────────────────────────┘
```

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository>
cd Enju
pnpm install  # Install all dependencies
```

### 2. Environment Setup
```bash
# Backend (.env)
cp backend/.env.example backend/.env

# Add your configuration:
TRON_PRIVATE_KEY=your_tron_private_key
TRON_API_KEY=your_trongrid_api_key
TRON_BRIDGE_CONTRACT=deployed_contract_address
```

### 3. Deploy Contracts

#### Ethereum
```bash
cd eth-contracts
forge script script/DeployInchDirectBridge.s.sol --broadcast
```

#### NEAR
```bash
cd near-contracts
./build.sh && ./deploy.sh <account-id>
```

#### Tron
```bash
# Get energy first: https://shasta.tronex.io/
TRON_PRIVATE_KEY=<key> tronbox migrate --network shasta
```

### 4. Start Services
```bash
# Backend API
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev

# Bridge Resolver
cd cross-chain && npm run relayer
```

## 💱 Supported Swaps

| From | To | Conversion | Example |
|------|----|-----------| --------|
| ETH | NEAR | Auto price | 0.1 ETH → ~140 NEAR |
| NEAR | ETH | Auto price | 100 NEAR → ~0.071 ETH |
| ETH | TRX | Auto price | 0.1 ETH → ~1120 TRX |
| TRX | ETH | Auto price | 1000 TRX → ~0.089 ETH |

**Fees**: 0.3% bridge fee + gas costs

## 🔧 Technical Components

### Smart Contracts
- **InchDirectBridge.sol** - Ethereum HTLC with 1inch integration
- **TronDirectBridge.sol** - Tron HTLC with TRX handling  
- **lib.rs** - NEAR cross-chain HTLC contract

### Backend Services
- **Price Oracle** - Real-time ETH/NEAR/TRX rates with CoinGecko/Binance APIs
- **Bridge API** - REST endpoints for swap management
- **Event Monitor** - Cross-chain event listening and coordination
- **Resolver Service** - Atomic swap execution with price conversions

### Enju - 3D Frontend Experience
- **React + Three.js** - Immersive 3D environment powered by `@react-three/fiber`
- **Dynamic Island Ecosystem** - Personal floating islands that evolve with transactions
- **Transaction Visualization** - Bridge swaps generate trees, chests, and expand your world
- **Multi-Wallet Support** - MetaMask, NEAR Wallet, TronLink integration
- **Interactive Elements** - 3D characters, animated decorations, environmental growth
- **Persistent World** - Island state saves and loads with your transaction history
- **Procedural Generation** - Islands created from transaction seeds using noise algorithms

## 🔒 Security Features

### 1inch Battle-Tested Infrastructure
- **EscrowFactory**: Uses official 1inch deployed contracts
- **Immutables Verification**: Ensures swap integrity
- **Timelock Protection**: 24-hour default expiration

### Atomic Guarantees
- **Same Hashlock**: Both chains use identical SHA256 hash
- **Coordinated Timelock**: Prevents partial completion
- **Emergency Recovery**: Owner can rescue stuck funds after 7 days

### Authorization System
- **Resolver Authorization**: Only authorized resolvers can execute
- **Owner Controls**: Emergency functions protected
- **Event Logging**: Full audit trail

## 📊 Testing

### Ethereum Tests
```bash
cd eth-contracts
forge test -vv

# Test specific scenarios
forge test --match-test testAuthorizeResolver
forge test --match-test testRegisterNEARSwap
```

### NEAR Tests
```bash
cd near-contracts/htlc-near
cargo test

# Test cross-chain functionality
cargo test test_cross_chain_htlc
```

## 🌐 Deployment Addresses

### Ethereum Mainnet/Testnets
- **Official EscrowFactory**: `0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a`
- **Cross-Chain Resolver**: [Deploy using script]

### NEAR Protocol
- **Contract Account**: [Deploy using build script]

## 📋 Integration Guide

### For Developers
1. **Import Interfaces**: Use provided contract interfaces
2. **Authorize Resolvers**: Register trusted resolver addresses
3. **Monitor Events**: Listen for swap initiation/completion
4. **Handle Errors**: Implement proper error handling for timeouts

### For Resolvers
1. **Register**: Get authorized by contract owner
2. **Monitor**: Watch for cross-chain swap events
3. **Execute**: Coordinate between Ethereum and NEAR
4. **Verify**: Ensure atomic completion or reversion

## 🎮 Enju - 3D DeFi Experience

### Immersive Bridge Interface
- **Dynamic 3D Island** - Your personal floating ecosystem that grows with transactions
- **Transaction Visualization** - Bridge swaps spawn trees, chests, and island expansions  
- **Interactive Elements** - 3D character, animated decorations, environmental evolution
- **Persistent State** - Island saves/loads with your transaction history

### Technical Implementation
- **React Three Fiber** - WebGL-powered 3D rendering in browser
- **Three.js** - Advanced 3D graphics and animations
- **Procedural Generation** - Islands generated from transaction seeds
- **Multi-Wallet Integration** - Seamless Web3 wallet connections

### User Experience
- **Gamified Bridging** - Each swap grows your digital world
- **Visual Transaction History** - See your DeFi journey in 3D space
- **Social Elements** - Shareable island states and achievements
- **Mobile Responsive** - Works across devices with optimized rendering

## 🏆 Why UniteDeFi Bridge

### Technical Excellence  
- **1inch Fusion+ Integration** - Built on battle-tested infrastructure
- **Real-Time Price Oracle** - Automatic conversions with dual API sources
- **Multi-Chain Support** - ETH, NEAR, and TRON ecosystems united
- **Production Ready** - Fully tested contracts and services

### User Innovation
- **Enju 3D Interface** - First gamified cross-chain bridge experience
- **Automatic Conversions** - No manual rate calculations needed
- **Visual Progress** - Watch your island evolve with each transaction
- **Seamless UX** - Complex bridging made simple and engaging

### Ecosystem Impact
- **Liquidity Bridge** - Connect major blockchain ecosystems
- **DeFi Gamification** - Make complex operations intuitive and fun
- **Open Innovation** - Extensible architecture for community building

## 🌟 Enju Features Showcase

### 3D Transaction Visualization
```typescript
// Every bridge transaction grows your island
const transaction = await executeBridge({
  fromAmount: '0.1',
  fromChain: 'ethereum',
  toChain: 'tron'
});

// Island automatically spawns new tree/chest
island.addRandomTree(); // Based on transaction hash
island.enlargeIsland(); // After major swaps
```

### Dynamic World Generation
- **Hex-tile Islands** - Procedurally generated from your wallet address
- **Animated Trees** - Grow with each successful swap
- **Treasure Chests** - Appear for large volume transactions  
- **Floating Animation** - Islands gently bob in 3D space
- **Environmental Effects** - Water reflections, particle systems

### Gamified Bridge Experience
- **Visual Feedback** - See immediate 3D response to transactions
- **Progress Tracking** - Island size reflects your bridge usage
- **Achievement System** - Unlock new decorations and expansions
- **Social Sharing** - Export and share your unique island

## 📞 Support & Resources

- **GitHub**: [Repository Link]
- **Documentation**: See `/docs` folder
- **Discord**: 1inch Community
- **Testnet Faucets**:
  - NEAR: https://wallet.testnet.near.org/
  - Tron: https://shasta.tronex.io/

---

**🎯 UniteDeFi Bridge: Where DeFi meets immersive 3D experiences. Bringing 1inch Fusion+ liquidity to NEAR and Tron ecosystems with gamified interfaces and automatic price discovery.**