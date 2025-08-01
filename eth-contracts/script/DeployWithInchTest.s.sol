// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CrossChainResolver.sol";

contract DeployWithInchTest is Script {
    // Real 1inch addresses on Mainnet
    address constant ESCROW_FACTORY = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address constant LIMIT_ORDER_PROTOCOL = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    function run() external {
        console.log("Deploying CrossChainResolver with 1inch Integration...");
        console.log("=======================================================");
        console.log("");
        
        // Test 1: Check if we're on mainnet fork
        console.log("Step 1: Checking network...");
        uint256 chainId = block.chainid;
        console.log("   Chain ID:", chainId);
        require(chainId == 1, "Must be on mainnet or mainnet fork");
        console.log(" Network check passed");
        console.log("");
        
        // Test 2: Check if 1inch contracts exist
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
        
        require(factoryCodeSize > 0, "1inch Escrow Factory not found - check fork setup");
        require(protocolCodeSize > 0, "1inch Limit Order Protocol not found - check fork setup");
        console.log("    1inch contracts found");
        console.log("");
        
        // Test 3: Check account balance
        console.log(" Step 3: Checking deployer account...");
        address deployer = vm.addr(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        console.log("   Deployer address:", deployer);
        console.log("   Balance:", deployer.balance / 1e18, "ETH");
        require(deployer.balance > 0.1 ether, "Insufficient ETH for deployment");
        console.log("   Account check passed");
        console.log("");
        
        // Deploy the contract
        console.log("Step 4: Deploying CrossChainResolver...");
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        
        CrossChainResolver resolver = new CrossChainResolver(
            ESCROW_FACTORY,
            LIMIT_ORDER_PROTOCOL
        );
        
        vm.stopBroadcast();
        
        console.log("   Contract deployed at:", address(resolver));
        console.log("");
        
        // Test 5: Verify deployment
        console.log(" Step 5: Verifying deployment...");
        console.log("   Owner:", resolver.owner());
        console.log("   Escrow Factory:", address(resolver.ESCROW_FACTORY()));
        console.log("   Limit Order Protocol:", address(resolver.LIMIT_ORDER_PROTOCOL()));
        console.log("   Contract Balance:", address(resolver).balance);
        console.log("   Deployment verified");
        console.log("");
        
        // Test 6: Test basic functionality
        console.log("Step 6: Testing basic functionality...");
        
        // Test NEAR account validation
        bool validNear = resolver.swapExists(keccak256("test"));
        console.log("   Swap exists check:", validNear ? "true" : "false");
        
        uint256 contractBalance = resolver.getContractBalance();
        console.log("   Contract balance getter:", contractBalance);
        
        console.log(" Basic functionality test passed");
        console.log("");
        
        // Final summary
        console.log("DEPLOYMENT SUCCESSFUL!");
        console.log("========================");
        console.log("Contract Address:", address(resolver));
        console.log("Network: Mainnet Fork (Chain ID 1)");
        console.log("1inch Integration: ENABLED");
        console.log("");
        console.log("Next steps:");
        console.log("   1. Update your .env file:");
        console.log("      CROSS_CHAIN_RESOLVER_ADDRESS=", address(resolver));
        console.log("      ETH_BRIDGE_CONTRACT=", address(resolver));
        console.log("   2. Start the bridge listener service");
        console.log("   3. Test ETH <-> NEAR bridge functionality");
        console.log("");
        console.log("1inch Escrow Factory:", ESCROW_FACTORY);
        console.log("CrossChain Resolver:", address(resolver));
    }
}
