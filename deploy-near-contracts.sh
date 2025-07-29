#!/bin/bash

# ===============================================
# NEAR Contracts Deployment Script
# Builds and deploys NEAR HTLC contracts
# ===============================================

set -e

echo "🔨 Deploying NEAR Contracts..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}📋 Checking NEAR deployment prerequisites...${NC}"
    
    if ! command -v near &> /dev/null; then
        echo -e "${RED}❌ NEAR CLI not found. Please install near-cli.${NC}"
        exit 1
    fi
    
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}❌ Cargo not found. Please install Rust.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ NEAR prerequisites found${NC}"
}

# Build NEAR contracts
build_contracts() {
    echo -e "${BLUE}🏗️ Building NEAR contracts...${NC}"
    
    if [ -d "near-contracts" ]; then
        cd near-contracts
        
        # Check if build script exists
        if [ -f "build.sh" ]; then
            echo -e "${BLUE}Running build script...${NC}"
            chmod +x build.sh
            ./build.sh
        else
            echo -e "${YELLOW}No build.sh found, attempting direct cargo build...${NC}"
            
            # Try to find Cargo.toml and build
            if [ -f "Cargo.toml" ]; then
                cargo build --target wasm32-unknown-unknown --release
            elif [ -d "htlc-near" ] && [ -f "htlc-near/Cargo.toml" ]; then
                cd htlc-near
                cargo build --target wasm32-unknown-unknown --release
                cd ..
            else
                echo -e "${RED}❌ No NEAR contract build configuration found${NC}"
                exit 1
            fi
        fi
        
        cd ..
        echo -e "${GREEN}✅ NEAR contracts built successfully${NC}"
    else
        echo -e "${RED}❌ near-contracts directory not found${NC}"
        exit 1
    fi
}

# Deploy to NEAR testnet (optional)
deploy_to_testnet() {
    echo -e "${BLUE}🚀 NEAR contract deployment options:${NC}"
    echo -e "${YELLOW}For testnet deployment, use:${NC}"
    echo -e "${BLUE}near deploy --accountId your-account.testnet --wasmFile target/wasm32-unknown-unknown/release/contract.wasm${NC}"
    echo -e "${YELLOW}Make sure you're logged in with: near login${NC}"
}

# Main function
main() {
    echo -e "${GREEN}🌉 NEAR Contract Deployment${NC}"
    echo -e "${GREEN}============================${NC}"
    
    check_prerequisites
    build_contracts
    deploy_to_testnet
    
    echo -e "\n${GREEN}🎉 NEAR build complete!${NC}"
    echo -e "${BLUE}WASM files ready for deployment${NC}"
}

# Run main function
main "$@"