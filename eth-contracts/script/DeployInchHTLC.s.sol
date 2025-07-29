// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/InchCrossChainResolver.sol";

contract DeployInchCrossChainResolver is Script {
    // Official 1inch Escrow Factory on most Ethereum chains
    address constant OFFICIAL_ESCROW_FACTORY = 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Cross-Chain Resolver
        InchCrossChainResolver resolver = new InchCrossChainResolver();
        
        console.log("InchCrossChainResolver deployed at:", address(resolver));
        console.log("Using official 1inch EscrowFactory at:", OFFICIAL_ESCROW_FACTORY);
        
        vm.stopBroadcast();
    }
    
    function runLocal() external {
        vm.startBroadcast();
        
        // Deploy Cross-Chain Resolver for local testing
        InchCrossChainResolver resolver = new InchCrossChainResolver();
        
        console.log("InchCrossChainResolver deployed at:", address(resolver));
        console.log("Note: Using official EscrowFactory hardcoded address");
        
        vm.stopBroadcast();
    }
}