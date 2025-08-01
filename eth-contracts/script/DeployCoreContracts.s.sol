// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CrossChainCore.sol";
import "../src/PartialFills.sol";
import "../src/BridgeUtils.sol";

contract DeployCoreContracts is Script {
    // Real 1inch addresses on Mainnet
    address constant ESCROW_FACTORY = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address constant LIMIT_ORDER_PROTOCOL = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    function run() external {
        console.log("Deploying Modular Cross-Chain Bridge...");
        console.log("=====================================");
        console.log("");
        
        // Check network
        console.log("Step 1: Checking network...");
        uint256 chainId = block.chainid;
        console.log("   Chain ID:", chainId);
        require(chainId == 1, "Must be on mainnet or mainnet fork");
        console.log(" Network check passed");
        console.log("");
        
        // Check 1inch contracts
        console.log("Step 2: Checking 1inch contracts...");
        console.log("   Escrow Factory:", ESCROW_FACTORY);
        console.log("   Limit Order Protocol:", LIMIT_ORDER_PROTOCOL);
        
        uint256 factoryCodeSize;
        uint256 protocolCodeSize;
        
        assembly {
            factoryCodeSize := extcodesize(ESCROW_FACTORY)
            protocolCodeSize := extcodesize(LIMIT_ORDER_PROTOCOL)
        }
        
        console.log("   Factory code size:", factoryCodeSize);
        console.log("   Protocol code size:", protocolCodeSize);
        
        require(factoryCodeSize > 0, "1inch Escrow Factory not found");
        require(protocolCodeSize > 0, "1inch Limit Order Protocol not found");
        console.log("    1inch contracts found");
        console.log("");
        
        // Check deployer account
        console.log("Step 3: Checking deployer account...");
        address deployer = vm.addr(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        console.log("   Deployer address:", deployer);
        console.log("   Balance:", deployer.balance / 1e18, "ETH");
        require(deployer.balance > 0.01 ether, "Insufficient balance");
        console.log(" Account check passed");
        console.log("");
        
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        
        // Deploy contracts
        console.log("Step 4: Deploying contracts...");
        
        CrossChainCore core = new CrossChainCore(ESCROW_FACTORY, LIMIT_ORDER_PROTOCOL);
        console.log("   Core Contract:", address(core));
        
        PartialFills partialFills = new PartialFills();
        console.log("   Partial Fills:", address(partialFills));
        
        BridgeUtils utils = new BridgeUtils();
        console.log("   Bridge Utils:", address(utils));
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("DEPLOYMENT SUCCESSFUL!");
        console.log("======================");
        console.log("Core Contract Address:", address(core));
        console.log("Partial Fills Address:", address(partialFills));
        console.log("Bridge Utils Address:", address(utils));
        console.log("");
        console.log("Next steps:");
        console.log("   1. Update your .env file:");
        console.log("      CROSS_CHAIN_RESOLVER_ADDRESS=", address(core));
        console.log("      ETH_BRIDGE_CONTRACT=", address(core));
        console.log("   2. Start the bridge listener service");
        console.log("   3. Test ETH <-> NEAR bridge functionality");
        console.log("");
        console.log("1inch Escrow Factory:", ESCROW_FACTORY);
        console.log("CrossChain Core:", address(core));
    }
}
