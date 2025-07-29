// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CrossChainBridge.sol";

contract DeployCrossChainBridge is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Cross-Chain Bridge
        CrossChainBridge bridge = new CrossChainBridge();
        
        console.log("CrossChainBridge deployed at:", address(bridge));
        console.log("Owner:", bridge.owner());
        
        vm.stopBroadcast();
    }
    
    function runLocal() external {
        vm.startBroadcast();
        
        // Deploy Cross-Chain Bridge for local testing
        CrossChainBridge bridge = new CrossChainBridge();
        
        console.log("CrossChainBridge deployed at:", address(bridge));
        console.log("Owner:", bridge.owner());
        
        vm.stopBroadcast();
    }
}