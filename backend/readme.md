
# Mokuen SwapForest — Backend

This backend powers the Mokuen SwapForest app, handling user data, game logic, blockchain interactions, and rewards.

## Features
- User management (wallet, profile, progression)
- Game state (biome, assets, quests)
- NFT and token reward distribution
- Blockchain interactions (Near, 1inch, future chains)
- API for frontend/game
- Secure database storage

## Database Models (suggested)
- **User**: wallet, profile, progression, inventory
- **Biome**: userId, terrain state, unlocked elements
- **Asset**: type (plant, animal, NFT), owner, properties
- **Quest**: questId, userId, status, rewards
- **Transaction**: userId, type (swap/bridge), chain, amount, reward

## Getting Started
1. Install dependencies: `pnpm install`
2. Configure your database (MongoDB/Postgres recommended)
3. Set environment variables in `.env`
4. Start the backend server: `pnpm run dev`

## Stack
- Node.js / Express
- MongoDB or PostgreSQL
- Web3 libraries for blockchain integration

See main project README for more details.
