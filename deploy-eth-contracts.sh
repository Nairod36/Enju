#!/bin/bash

# ===============================================
# ETH Contracts Deployment Script
# Deploys InchDirectBridge to Ethereum mainnet fork
# ===============================================

set -e

echo "🚀 Deploying Ethereum Contracts (InchDirectBridge)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}📋 Checking ETH deployment prerequisites...${NC}"
    
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}❌ Forge not found. Please install Foundry.${NC}"
        exit 1
    fi
    
    if ! command -v anvil &> /dev/null; then
        echo -e "${RED}❌ Anvil not found. Please install Foundry.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ ETH prerequisites found${NC}"
}

# Check Ethereum node
check_ethereum_node() {
    echo -e "${BLUE}🔗 Checking Ethereum node...${NC}"
    
    # Use environment variable or default to your VPS
    RPC_URL=${ETH_RPC_URL:-"http://vps-b11044fd.vps.ovh.net:8545/"}
    echo -e "${BLUE}Using RPC: ${RPC_URL}${NC}"
    
    # Try curl first, then fallback to simple connection test
    if curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' \
        "${RPC_URL}" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Ethereum node found${NC}"
    else
        echo -e "${RED}❌ No Ethereum node found at ${RPC_URL}${NC}"
        echo -e "${YELLOW}Please check your RPC connection${NC}"
        exit 1
    fi
}

# Deploy contracts
deploy_contracts() {
    echo -e "${BLUE}🏗️ Building and deploying InchDirectBridge...${NC}"
    
    cd eth-contracts
    
    # Build contracts
    echo -e "${BLUE}Building contracts...${NC}"
    forge build
    
    # Deploy with private key from command line (Anvil test account)
    echo -e "${BLUE}Deploying InchDirectBridge...${NC}"
    RPC_URL=${ETH_RPC_URL:-"http://vps-b11044fd.vps.ovh.net:8545/"}
    forge script script/DeployInchDirectBridge.s.sol:DeployInchDirectBridge \
        --rpc-url "${RPC_URL}" \
        --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
        --broadcast --legacy
    
    cd ..
    echo -e "${GREEN}✅ ETH contracts deployed successfully${NC}"
}

# Main function
main() {
    echo -e "${GREEN}🌉 ETH Contract Deployment${NC}"
    echo -e "${GREEN}===========================${NC}"
    
    check_prerequisites
    check_ethereum_node
    deploy_contracts
    
    echo -e "\n${GREEN}🎉 ETH deployment complete!${NC}"
    echo -e "${BLUE}Contract address will be shown in the deployment output above${NC}"
}

# Run main function
main "$@"