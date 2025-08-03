// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AnimalNFT.sol";
import "../src/AnimalMarketplace.sol";
import "../src/RewardToken.sol";

contract AnimalNFTSimpleTest is Test {
    AnimalNFT public animalNFT;
    AnimalMarketplace public marketplace;
    RewardToken public rewardToken;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        rewardToken = new RewardToken("Test Reward", "TREWARD", owner);
        animalNFT = new AnimalNFT(owner, address(rewardToken));
        marketplace = new AnimalMarketplace(address(animalNFT), address(rewardToken), owner);
        vm.stopPrank();
        
        // Donner des RewardTokens aux utilisateurs de test
        vm.startPrank(owner);
        rewardToken.transfer(user1, 1000 * 10**18);
        rewardToken.transfer(user2, 1000 * 10**18);
        vm.stopPrank();
    }

    function testMintAnimalWithTokens() public {
        vm.startPrank(user1);
        
        // Approuver les tokens pour le mint
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.CAT) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        
        // Test mint d'un chat avec des RewardTokens
        uint256 tokenId = animalNFT.mintAnimal(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        assertEq(tokenId, 1);
        assertEq(animalNFT.ownerOf(tokenId), user1);
        assertEq(animalNFT.totalSupply(), 1);
        
        // Vérifier les détails de l'animal
        AnimalNFT.Animal memory animal = animalNFT.getAnimalDetails(tokenId);
        assertEq(animal.name, "Whiskers");
        assertEq(uint256(animal.animalType), uint256(AnimalNFT.AnimalType.CAT));
        assertEq(animal.level, 1);
        assertEq(animal.experience, 0);
        
        vm.stopPrank();
    }

    function testMintNewAnimalTypes() public {
        vm.startPrank(user1);
        
        // Approuver assez de tokens pour tous les animaux
        rewardToken.approve(address(animalNFT), 500 * 10**18);
        
        // Test mint des nouveaux types d'animaux
        uint256 tigerTokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.TIGER, "Shere Khan");
        uint256 foxTokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.FOX, "Firefox");
        uint256 elephantTokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.ELEPHANT, "Dumbo");
        
        assertEq(animalNFT.totalSupply(), 3);
        
        // Vérifier les types d'animaux
        AnimalNFT.Animal memory tiger = animalNFT.getAnimalDetails(tigerTokenId);
        AnimalNFT.Animal memory fox = animalNFT.getAnimalDetails(foxTokenId);
        AnimalNFT.Animal memory elephant = animalNFT.getAnimalDetails(elephantTokenId);
        
        assertEq(uint256(tiger.animalType), uint256(AnimalNFT.AnimalType.TIGER));
        assertEq(uint256(fox.animalType), uint256(AnimalNFT.AnimalType.FOX));
        assertEq(uint256(elephant.animalType), uint256(AnimalNFT.AnimalType.ELEPHANT));
        
        vm.stopPrank();
    }

    function testMarketplaceListing() public {
        // User1 mint un animal
        vm.startPrank(user1);
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.CAT) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        uint256 tokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.CAT, "Whiskers");
        
        // Approuver le marketplace
        animalNFT.approve(address(marketplace), tokenId);
        
        // Lister l'animal
        uint256 listingPrice = 50 * 10**18; // 50 REWARD
        marketplace.listItem(tokenId, listingPrice);
        
        // Vérifier que l'animal est dans le marketplace
        assertEq(animalNFT.ownerOf(tokenId), address(marketplace));
        
        vm.stopPrank();
        
        // User2 achète l'animal
        vm.startPrank(user2);
        rewardToken.approve(address(marketplace), listingPrice);
        marketplace.buyItem(tokenId);
        
        // Vérifier le transfert
        assertEq(animalNFT.ownerOf(tokenId), user2);
        
        vm.stopPrank();
    }

    function testMarketplaceAuction() public {
        // User1 mint un animal
        vm.startPrank(user1);
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.TIGER) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        uint256 tokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.TIGER, "Shere Khan");
        
        // Approuver le marketplace
        animalNFT.approve(address(marketplace), tokenId);
        
        // Démarrer une enchère
        uint256 startingPrice = 30 * 10**18; // 30 REWARD
        uint256 duration = 1 days;
        uint256 minBidIncrement = 5 * 10**18; // 5 REWARD
        
        marketplace.startAuction(tokenId, startingPrice, duration, minBidIncrement);
        
        vm.stopPrank();
        
        // User2 place une enchère
        vm.startPrank(user2);
        uint256 bidAmount = 35 * 10**18; // 35 REWARD
        rewardToken.approve(address(marketplace), bidAmount);
        marketplace.placeBid(tokenId, bidAmount);
        
        vm.stopPrank();
        
        // Avancer le temps pour terminer l'enchère
        vm.warp(block.timestamp + duration + 1);
        
        // Terminer l'enchère
        marketplace.endAuction(tokenId);
        
        // Vérifier le transfert
        assertEq(animalNFT.ownerOf(tokenId), user2);
    }

    function testOnlyTokenPayment() public {
        vm.startPrank(user1);
        
        // Vérifier qu'on ne peut pas envoyer d'ETH (plus de fonction payable)
        // La fonction mintAnimal n'est plus payable, donc ceci devrait compiler sans problème
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.CAT) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        
        uint256 tokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.CAT, "OnlyTokens");
        
        assertEq(animalNFT.ownerOf(tokenId), user1);
        
        vm.stopPrank();
    }

    function testFeedAnimal() public {
        vm.startPrank(user1);
        
        // Mint un animal
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.CAT) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        uint256 tokenId = animalNFT.mintAnimal(AnimalNFT.AnimalType.CAT, "Whiskers");
        
        // Nourrir l'animal
        animalNFT.feedAnimal(tokenId);
        
        // Vérifier que l'expérience a augmenté
        AnimalNFT.Animal memory animal = animalNFT.getAnimalDetails(tokenId);
        assertTrue(animal.experience > 0);
        assertTrue(animal.lastFeedTime > 0);
        
        vm.stopPrank();
    }
}