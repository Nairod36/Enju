// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AnimalNFT.sol";
import "../src/AnimalMarketplace.sol";
import "../src/RewardToken.sol";
import "../src/AnimalTypeFactory.sol";

/**
 * @title DeployAnimalContracts
 * @dev Script de déploiement pour les contrats NFT d'animaux et le marketplace
 */
contract DeployAnimalContracts is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Déployer ou utiliser le RewardToken existant
        console.log("Deploying RewardToken...");
        RewardToken rewardToken = new RewardToken("Enju Reward Token", "REWARD", deployer);
        console.log("RewardToken deployed at:", address(rewardToken));

        // Déployer la factory pour les types d'animaux
        console.log("Deploying AnimalTypeFactory...");
        AnimalTypeFactory animalTypeFactory = new AnimalTypeFactory(deployer);
        console.log("AnimalTypeFactory deployed at:", address(animalTypeFactory));

        // Déployer le contrat AnimalNFT
        console.log("Deploying AnimalNFT...");
        AnimalNFT animalNFT = new AnimalNFT(deployer, address(rewardToken), address(animalTypeFactory));
        console.log("AnimalNFT deployed at:", address(animalNFT));

        // Déployer le marketplace
        console.log("Deploying AnimalMarketplace...");
        AnimalMarketplace marketplace = new AnimalMarketplace(
            address(animalNFT),
            address(rewardToken),
            deployer
        );
        console.log("AnimalMarketplace deployed at:", address(marketplace));

        // Optionnel: Mint quelques animaux de test avec RewardTokens uniquement
        console.log("Minting test animals with RewardTokens...");
        
        // Approuver le contrat AnimalNFT pour dépenser des tokens
        rewardToken.approve(address(animalNFT), 1000 * 10**18);
        
        // Mint un chat avec des RewardTokens (type ID 0)
        uint256 tokenId1 = animalNFT.mintAnimal(
            0, // CAT
            "Whiskers"
        );
        console.log("Minted cat with tokens, ID:", tokenId1);

        // Mint un tigre avec des RewardTokens (type ID 5)
        uint256 tokenId2 = animalNFT.mintAnimal(
            5, // TIGER
            "Shere Khan"
        );
        console.log("Minted tiger with tokens, ID:", tokenId2);

        // Mint un renard avec des RewardTokens (type ID 6)
        uint256 tokenId3 = animalNFT.mintAnimal(
            6, // FOX
            "Firefox"
        );
        console.log("Minted fox with tokens, ID:", tokenId3);

        vm.stopBroadcast();

        // Log des informations de déploiement
        console.log("=== Deployment Summary ===");
        console.log("RewardToken:", address(rewardToken));
        console.log("AnimalTypeFactory:", address(animalTypeFactory));
        console.log("AnimalNFT:", address(animalNFT));
        console.log("AnimalMarketplace:", address(marketplace));
        console.log("Owner:", deployer);
        console.log("Total animals minted:", animalNFT.totalSupply());
        console.log("Animal types count:", animalTypeFactory.getAnimalTypeCount());
        
        // Sauvegarder les adresses dans un fichier JSON pour le frontend
        string memory json = string.concat(
            '{\n',
            '  "RewardToken": "', vm.toString(address(rewardToken)), '",\n',
            '  "AnimalTypeFactory": "', vm.toString(address(animalTypeFactory)), '",\n',
            '  "AnimalNFT": "', vm.toString(address(animalNFT)), '",\n',
            '  "AnimalMarketplace": "', vm.toString(address(marketplace)), '",\n',
            '  "Owner": "', vm.toString(deployer), '",\n',
            '  "ChainId": ', vm.toString(block.chainid), ',\n',
            '  "BlockNumber": ', vm.toString(block.number), '\n',
            '}'
        );
        
        vm.writeFile("./deployments/animal-contracts.json", json);
        console.log("Deployment info saved to ./deployments/animal-contracts.json");
    }
}