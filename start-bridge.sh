#!/bin/bash

# ===============================================
# Enju Bridge Setup Script - ETH ↔ NEAR
# Using 1inch Fusion+ Technology
# ===============================================

set -e

echo "🌉 Starting Enju Cross-Chain Bridge Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_prerequisites() {
    echo -e "${BLUE}📋 Checking prerequisites...${NC}"
    
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}❌ Forge not found. Please install Foundry.${NC}"
        exit 1
    fi
    
    if ! command -v anvil &> /dev/null; then
        echo -e "${RED}❌ Anvil not found. Please install Foundry.${NC}"
        exit 1
    fi
    
    if ! command -v near &> /dev/null; then
        echo -e "${RED}❌ NEAR CLI not found. Please install near-cli.${NC}"
        exit 1
    fi
    
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}❌ Cargo not found. Please install Rust.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites found${NC}"
}

# Check Ethereum node
check_ethereum_node() {
    echo -e "${BLUE}🔗 Checking Ethereum node...${NC}"
    
    # Check if port 8545 is listening (Windows compatible)
    if netstat -an | grep -q ":8545.*LISTENING"; then
        echo -e "${GREEN}✅ Ethereum node found on port 8545${NC}"
    else
        echo -e "${RED}❌ No Ethereum node found on port 8545${NC}"
        echo -e "${YELLOW}Please start the mainnet fork first: ./start-mainnet-fork.sh${NC}"
        exit 1
    fi
}

# Deploy Ethereum contracts using dedicated script
deploy_ethereum_contracts() {
    echo -e "${BLUE}🚀 Deploying ETH contracts...${NC}"
    ./deploy-eth-contracts.sh
    echo -e "${GREEN}✅ ETH contracts deployed${NC}"
}

# Deploy NEAR contracts using dedicated script
deploy_near_contracts() {
    echo -e "${BLUE}🔨 Deploying NEAR contracts...${NC}"
    ./deploy-near-contracts.sh
    echo -e "${GREEN}✅ NEAR contracts deployed${NC}"
}

# Start frontend
start_frontend() {
    echo -e "${BLUE}🌐 Starting Frontend...${NC}"
    cd frontend
    [ ! -d "node_modules" ] && npm install
    npm run dev &
    echo $! > .frontend.pid
    echo -e "${GREEN}✅ Frontend: http://localhost:5173${NC}"
    cd ..
}

# Main setup function
main() {
    echo -e "${GREEN}🌉 Enju Cross-Chain Bridge Setup${NC}"
    echo -e "${GREEN}================================${NC}"
    
    check_prerequisites
    echo -e "${YELLOW}Make sure Anvil is running on port 8545${NC}"
    echo -e "${BLUE}Waiting for Anvil to be ready...${NC}"
    sleep 3
    
    echo -e "\n${BLUE}Starting services...${NC}"
    deploy_ethereum_contracts
    deploy_near_contracts  
    start_frontend
    
    echo -e "\n${GREEN}🎉 Bridge ready!${NC}"
    echo -e "${GREEN}📡 Ethereum: http://localhost:8545${NC}"
    echo -e "${GREEN}🌐 Frontend: http://localhost:5173${NC}"
    echo -e "\n${YELLOW}Stop with: ./stop-bridge.sh${NC}"
}

# Run main function
main "$@"