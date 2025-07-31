// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CrossChainResolver.sol";

contract DeployCrossChainResolver is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Official 1inch contracts on Ethereum mainnet
        address escrowFactory = 0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A;
        address limitOrderProtocol = 0x111111125421cA6dc452d289314280a0f8842A65; // 1inch v5 router
        
        CrossChainResolver resolver = new CrossChainResolver(
            escrowFactory,
            limitOrderProtocol
        );
        
        console.log("CrossChainResolver deployed at:", address(resolver));
        console.log("EscrowFactory:", escrowFactory);
        console.log("LimitOrderProtocol:", limitOrderProtocol);
        console.log("Owner:", resolver.owner());
        
        vm.stopBroadcast();
    }
}