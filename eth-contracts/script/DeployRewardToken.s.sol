// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/RewardToken.sol";

contract DeployRewardToken is Script {
    function run() external {
        // Lire les clés privées depuis le .env
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 rewardOwnerKey = vm.envUint("REWARD_TOKEN_OWNER_PRIVATE_KEY");
        
        address deployer = vm.addr(deployerKey);
        address rewardOwner = vm.addr(rewardOwnerKey);
        
        console.log("Deployer:", deployer);
        console.log("Reward Owner:", rewardOwner);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        console.log("Reward Owner balance:", rewardOwner.balance / 1e18, "ETH");

        vm.startBroadcast(deployerKey);

        // Deploy RewardToken avec rewardOwner comme owner
        RewardToken rewardToken = new RewardToken(
            "Enju Reward Token",  // name
            "REWARD",             // symbol  
            rewardOwner           // initial owner (pas le deployer)
        );

        vm.stopBroadcast();

        console.log("RewardToken deployed at:", address(rewardToken));
        console.log("Token Name:", rewardToken.name());
        console.log("Token Symbol:", rewardToken.symbol());
        console.log("Total Supply:", rewardToken.totalSupply() / 1e18, "REWARD");
        console.log("Owner:", rewardToken.owner());

        // Save deployment info to file
        string memory deploymentInfo = string(
            abi.encodePacked(
                "# Reward Token Deployment Info\n",
                "REWARD_TOKEN_ADDRESS=", vm.toString(address(rewardToken)), "\n",
                "REWARD_OWNER_ADDRESS=", vm.toString(rewardOwner), "\n",
                "REWARD_TOKEN_OWNER_PRIVATE_KEY=0x", vm.toString(rewardOwnerKey), "\n"
            )
        );
        
        console.log("");
        console.log("Addresses:");
        console.log("- Reward Owner:", rewardOwner);
        console.log("- Reward Owner Private Key: 0x", vm.toString(rewardOwnerKey));
        console.log("");
        console.log("Next steps:");
        console.log("1. Copy variables to backend/.env");
        console.log("2. Add backend service as minter using addMinter()");
        console.log("3. Test the reward system");
    }
}