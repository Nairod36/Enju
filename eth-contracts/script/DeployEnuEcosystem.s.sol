// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Script.sol";
import "../src/EnuToken.sol";
import "../src/IslandAnimals.sol";
import "../src/AnimalMarketplace.sol";
import "../src/CrossChainResolver.sol";

/**
 * @title DeployEnuEcosystem - Deploy Enju Token, NFT, and Marketplace
 * @dev Deployment script for the complete Enju ecosystem contracts
 */
contract DeployEnuEcosystem is Script {
    
    // Official 1inch EscrowFactory on Ethereum mainnet
    address constant ESCROW_FACTORY = 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a;
    address constant LIMIT_ORDER_PROTOCOL = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying Enju Ecosystem...");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy ENU Token
        console.log("1. Deploying ENU Token...");
        EnuToken enuToken = new EnuToken();
        console.log("ENU Token deployed at:", address(enuToken));
        
        // 2. Deploy Island Animals NFT
        console.log("2. Deploying Island Animals NFT...");
        IslandAnimals islandAnimals = new IslandAnimals();
        console.log("Island Animals deployed at:", address(islandAnimals));
        
        // 3. Deploy Animal Marketplace
        console.log("3. Deploying Animal Marketplace...");
        AnimalMarketplace marketplace = new AnimalMarketplace(
            address(enuToken),
            address(islandAnimals)
        );
        console.log("Animal Marketplace deployed at:", address(marketplace));
        
        // 4. Deploy CrossChainResolver (if not already deployed)
        console.log("4. Deploying CrossChain Resolver...");
        CrossChainResolver resolver = new CrossChainResolver(
            ESCROW_FACTORY,
            LIMIT_ORDER_PROTOCOL
        );
        console.log("CrossChain Resolver deployed at:", address(resolver));
        
        // 5. Configure permissions
        console.log("5. Configuring permissions...");
        
        // Authorize CrossChainResolver to mint ENU tokens
        enuToken.authorizeMinter(address(resolver));
        console.log("- CrossChainResolver authorized as ENU minter");
        
        // Authorize Marketplace to burn ENU tokens (for upgrades)
        enuToken.authorizeBurner(address(marketplace));
        console.log("- Marketplace authorized as ENU burner");
        
        // Authorize Marketplace to mint Island Animals NFTs
        islandAnimals.authorizeMinter(address(marketplace));
        console.log("- Marketplace authorized as NFT minter");
        
        // Set ENU token in CrossChainResolver
        resolver.setEnuToken(address(enuToken));
        console.log("- ENU token set in CrossChainResolver");
        
        vm.stopBroadcast();
        
        // 6. Display deployment summary
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("ENU Token:", address(enuToken));
        console.log("Island Animals NFT:", address(islandAnimals));
        console.log("Animal Marketplace:", address(marketplace));
        console.log("CrossChain Resolver:", address(resolver));
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Verify contracts on Etherscan");
        console.log("2. Update frontend with new contract addresses");
        console.log("3. Test minting and marketplace functionality");
        console.log("4. Fund marketplace with initial liquidity if needed");
        
        // 7. Save deployment addresses to file
        _saveDeploymentAddresses(
            address(enuToken),
            address(islandAnimals),
            address(marketplace),
            address(resolver)
        );
    }
    
    function _saveDeploymentAddresses(
        address enuToken,
        address islandAnimals,
        address marketplace,
        address resolver
    ) private {
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "network": "', vm.toString(block.chainid), '",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '",\n',
            '  "contracts": {\n',
            '    "EnuToken": "', vm.toString(enuToken), '",\n',
            '    "IslandAnimals": "', vm.toString(islandAnimals), '",\n',
            '    "AnimalMarketplace": "', vm.toString(marketplace), '",\n',
            '    "CrossChainResolver": "', vm.toString(resolver), '"\n',
            '  }\n',
            '}'
        ));
        
        vm.writeFile("./deployments/enju-ecosystem.json", json);
        console.log("Deployment addresses saved to ./deployments/enju-ecosystem.json");
    }
}
