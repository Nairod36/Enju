// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/InchDirectBridge.sol";

contract DeployInchDirectBridge is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy 1inch Direct Bridge
        InchDirectBridge bridge = new InchDirectBridge();
        
        console.log("InchDirectBridge deployed at:", address(bridge));
        console.log("Owner:", bridge.owner());
        
        // Check if 1inch EscrowFactory is available on this network
        bool factoryAvailable = bridge.checkEscrowFactory();
        console.log("1inch EscrowFactory available:", factoryAvailable);
        
        if (factoryAvailable) {
            console.log("Ready to use 1inch contracts directly");
        } else {
            console.log("1inch EscrowFactory not found - check network");
        }
        
        vm.stopBroadcast();
    }
}