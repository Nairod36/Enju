# 🌟 Enju - Gamified Cross-Chain Bridge Platform

## 🎯 Project Overview

**Enju** is a revolutionary cross-chain DeFi platform that transforms traditional bridging into an immersive gamified experience. Built as an extension to the 1inch Fusion+ protocol, it enables seamless **ETH ↔ NEAR ↔ TRON** atomic swaps while rewarding users with a unique 3D ecosystem that grows with their DeFi journey.

### 🏆 Current Implemented Features
- ✅ **Bidirectional Cross-Chain Bridge**: ETH ↔ TRON and ETH ↔ NEAR atomic swaps with HTLC security
- ✅ **1inch API Swap Integration**: ETH to multiple crypto swaps using 1inch API
- ✅ **Real-Time Price Oracle**: Automatic conversions using CoinGecko/Binance APIs
- ✅ **3D Immersive Interface**: Dynamic floating islands powered by Three.js
- ✅ **Transaction Visualization**: Every swap or bridge grows your island with trees and animations
- ✅ **Multi-Wallet Support**: MetaMask, TronLink, and NEAR Wallet integration
- ✅ **Level Progression System**: Gain XP and levels from swaps and bridges
- ✅ **Reward Token System**: Earn tokens for completing bridge operations
- ✅ **Interactive 3D Animals**: Chain-specific animated companions (Elephant for ETH, Tiger for TRON, Fox for NEAR)

### 🚀 Upcoming Features (Roadmap)
- 🏪 **NFT Marketplace**: Spend reward tokens on unique island decorations and upgrades
- 🎨 **Enhanced 3D Assets**: More detailed animal models and environmental elements
- 🏆 **Achievement System**: Unlock rare island items by hitting transaction milestones
- 🌐 **Extra Chain Support**: Extend bridges to other chains beyond ETH/NEAR/TRON

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│        ENJU FRONTEND            │
│  ┌─────────┐ ┌─────────────────┐│
│  │ Three.js│ │  React Components││
│  │ 3D World│ │  - Bridge UI    ││
│  │ Islands │ │  - Wallet Mgmt  ││
│  │ Animals │ │  - Level System ││
│  └─────────┘ └─────────────────┘│
└─────────────────┬───────────────┘
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ETHEREUM │  │  NEAR   │  │  TRON   │
│         │  │ (Coming)│  │         │
│CrossChain│  │htlc-near│  │TronFusion│
│Core     │  │.rs      │  │Bridge   │
│1inch    │  │Cross-   │  │HTLC +   │
│Fusion+  │  │chain    │  │Events   │
└─────────┘  └─────────┘  └─────────┘
     ▲            ▲            ▲
     │            │            │
     └────────────┼────────────┘
                  ▼
    ┌─────────────────────────────┐
    │     BRIDGE RESOLVER         │
    │  ┌─────────┐ ┌─────────────┐│
    │  │Price    │ │Event        ││
    │  │Oracle   │ │Listener     ││
    │  │CoinGecko│ │Multi-Chain  ││
    │  │Binance  │ │Monitoring   ││
    │  └─────────┘ └─────────────┘│
    └─────────────────────────────┘
```


## 💱 Supported Swaps

| From | To | Conversion | Example | Status |
|------|----|-----------| --------|--------|
| ETH | TRX | Auto price | 0.1 ETH → ~1120 TRX | ✅ Live |
| TRX | ETH | Auto price | 1000 TRX → ~0.089 ETH | ✅ Live |
| ETH | NEAR | Auto price | 0.1 ETH → ~140 NEAR | ✅ Live |
| NEAR | ETH | Auto price | 100 NEAR → ~0.071 ETH |✅ Live |

**Fees**: 0.3% bridge fee + gas costs

## 🔧 Technical Components


### Backend Services
- **Price Oracle** - Real-time ETH/NEAR/TRX rates with CoinGecko/Binance APIs
- **Bridge API** - REST endpoints for swap management
- **Event Monitor** - Cross-chain event listening and coordination
- **Resolver Service** - Atomic swap execution with price conversions

### Enju - 3D Gamified Frontend
- **React + Three.js** - Immersive 3D environment powered by `@react-three/fiber`
- **Dynamic Island Ecosystem** - Personal floating islands that evolve with transactions
- **3D Chain Animals** - Interactive companions: Elephant (ETH), Tiger (TRON), Fox (NEAR)
- **Transaction Visualization** - Bridge swaps generate trees, chests, and expand your world
- **Level Progression** - User levels increase with bridge activity and transaction volume
- **Multi-Wallet Support** - MetaMask, NEAR Wallet, TronLink integration
- **Interactive Elements** - Animated decorations, environmental growth, clickable objects
- **Persistent World** - Island state saves and loads with your transaction history
- **Procedural Generation** - Islands created from transaction seeds using noise algorithms
- **Reward System** - Earn tokens for completing bridges (upcoming feature)

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

## 📊 Testing Links: 


---

## 🏅 ETHGlobal Submission Highlights

### ✅ Fully Functional Demo Ready
- Live **ETH ↔ TRON** and **ETH ↔ NEAR** bridge with real transactions
- Complete **3D gamified interface** with chain-specific animated companions
- Multi-wallet integration (MetaMask + TronLink + NEAR Wallet)
- Real-time price oracle with automatic conversions
- Level progression + island growth tied to swap/bridge activity
- Token rewards system activated after bridge operations

### 🥇 Submission Tracks Targeted

#### 🌐 Extend Fusion+ to NEAR — **$32,000 Prize Pool**
- 🔁 Fully bidirectional ETH ↔ NEAR swaps with HTLC and coordinated timelocks
- 🛡️ SHA256 hashlock preserved across EVM ↔ non-EVM architecture
- 📡 Onchain execution demonstrated during live demo
- 🎮 Stretch goals met:
  - Immersive 3D UI integrated with actual bridge flow
  - Dynamic user feedback after bridge actions (tree planting, animal animations)

---

#### 🌐 Extend Fusion+ to TRON — **$32,000 Prize Pool**
- 🔁 Bidirectional ETH ↔ TRON swaps using HTLC-compatible contracts
- 🛡️ Full support for hashlock/timelock logic across Ethereum and TRON
- 🚀 TronLink wallet integration, live swaps shown on Shasta testnet
- 🎮 Stretch goals met:
  - Interactive island growth and level up after each swap
  - Real-time transaction visualization with 3D elements

---

#### 🧰 Build a Full Application using 1inch APIs — **$30,000 Prize Pool**
- 🔄 Full swap functionality using **1inch Swap API** for ETH → any token
- 📊 Real-time rates via **Price Feed API**
- 🧠 Integrated wallet detection & balance display using 1inch Wallet APIs
- 🎨 Frontend built with React + Three.js using 1inch APIs for all swaps

---

### 🎯 What Makes Enju Unique
- **First gamified DeFi bridge** with real-time, cross-chain execution
- **EVM ↔ non-EVM HTLC architecture** implemented for NEAR and TRON
- **Real user actions = in-game growth**, making DeFi visual and intuitive
- **Rewarded bridging**: token incentives, leveling system, and future NFTs

---

**🌟 Enju: Transforming DeFi accessibility through immersive gamification. Where every cross-chain swap grows your personal 3D world, making blockchain complexity beautiful and intuitive.**
