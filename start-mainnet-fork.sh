#!/bin/bash

# ===============================================
# Ethereum Mainnet Fork Script  
# Simple fork script for 1inch integration
# ===============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔗 Starting Ethereum Mainnet Fork...${NC}"

# Default to free RPC if not set
if [ -z "$ETH_RPC_URL" ]; then
    echo -e "${YELLOW}⚠️  ETH_RPC_URL not set, using free public RPC${NC}"
    export ETH_RPC_URL="https://rpc.ankr.com/eth"
fi

# Check if Anvil is available
if ! command -v anvil &> /dev/null; then
    echo -e "${RED}❌ Anvil not found. Please install Foundry.${NC}"
    echo -e "${YELLOW}Install with: curl -L https://foundry.paradigm.xyz | bash${NC}"
    exit 1
fi

# Stop existing Anvil processes
echo -e "${YELLOW}🛑 Stopping existing Anvil processes...${NC}"
if tasklist /FI "IMAGENAME eq anvil.exe" 2>NUL | grep -q "anvil.exe"; then
    taskkill /F /IM "anvil.exe" 2>NUL || true
    sleep 2
fi

echo -e "${BLUE}🚀 Starting Anvil with mainnet fork...${NC}"
echo -e "${BLUE}   RPC URL: ${ETH_RPC_URL}${NC}"

# Start Anvil with mainnet fork
anvil \
    --fork-url "${ETH_RPC_URL}" \
    --chain-id 1 \
    --host 0.0.0.0 \
    --port 8545 \
    --accounts 10 \
    --balance 1000 \
    --gas-limit 30000000 \
    --block-time 2 \
    --no-rate-limit &

ANVIL_PID=$!
echo $ANVIL_PID > .anvil-mainnet.pid

echo -e "\n${GREEN}🎉 Ethereum Mainnet Fork Started!${NC}"
echo -e "${GREEN}📡 RPC: http://localhost:8545${NC}"
echo -e "${GREEN}🔐 Test Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80${NC}"
echo -e "${GREEN}📝 PID: ${ANVIL_PID}${NC}"

echo -e "\n${YELLOW}Next: ./start-bridge.sh (in another terminal)${NC}"
echo -e "${BLUE}Press Ctrl+C to stop...${NC}"
wait $ANVIL_PID