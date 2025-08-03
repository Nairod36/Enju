// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AnimalNFT.sol";
import "../src/AnimalMarketplace.sol";
import "../src/RewardToken.sol";

contract AnimalNFTTest is Test {
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
        
        // Donner de l'ETH aux utilisateurs de test
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        
        // Donner des RewardTokens aux utilisateurs de test
        vm.startPrank(owner);
        rewardToken.transfer(user1, 1000 * 10**18);
        rewardToken.transfer(user2, 1000 * 10**18);
        vm.stopPrank();
    }

    // Helper function to mint animal with tokens
    function mintAnimalHelper(address user, AnimalNFT.AnimalType animalType, string memory name) internal returns (uint256) {
        vm.startPrank(user);
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(animalType) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        uint256 tokenId = animalNFT.mintAnimal(animalType, name);
        vm.stopPrank();
        return tokenId;
    }

    function testMintAnimal() public {
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
        assertTrue(animal.strength >= 10); // Stat minimale
        assertTrue(animal.agility >= 10);
        assertTrue(animal.intelligence >= 10);
        
        vm.stopPrank();
    }

    function testMintAnimalInsufficientTokens() public {
        vm.startPrank(user1);
        
        // Ne pas approuver assez de tokens
        uint256 lowApproval = 1 * 10**18; // Seulement 1 REWARD
        rewardToken.approve(address(animalNFT), lowApproval);
        
        // Essayer de mint sans assez de tokens approuvés
        vm.expectRevert("Token transfer failed");
        animalNFT.mintAnimal(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        vm.stopPrank();
    }

    function testFeedAnimal() public {
        vm.startPrank(user1);
        
        // Mint un animal
        uint256 basePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 maxPrice = basePrice * 10;
        uint256 tokenId = animalNFT.mintAnimal{value: maxPrice}(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        // Nourrir l'animal
        animalNFT.feedAnimal(tokenId);
        
        // Vérifier que l'expérience a augmenté
        AnimalNFT.Animal memory animal = animalNFT.getAnimalDetails(tokenId);
        assertTrue(animal.experience > 0);
        assertTrue(animal.lastFeedTime > 0);
        
        vm.stopPrank();
    }

    function testFeedAnimalCooldown() public {
        vm.startPrank(user1);
        
        // Mint un animal
        uint256 basePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 maxPrice = basePrice * 10;
        uint256 tokenId = animalNFT.mintAnimal{value: maxPrice}(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        // Nourrir l'animal
        animalNFT.feedAnimal(tokenId);
        
        // Essayer de nourrir immédiatement (devrait échouer)
        vm.expectRevert("Still in cooldown");
        animalNFT.feedAnimal(tokenId);
        
        vm.stopPrank();
    }

    function testGetOwnerAnimals() public {
        vm.startPrank(user1);
        
        // Mint plusieurs animaux
        uint256 catBasePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 dogBasePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.DOG);
        uint256 catMaxPrice = catBasePrice * 10;
        uint256 dogMaxPrice = dogBasePrice * 10;
        
        animalNFT.mintAnimal{value: catMaxPrice}(AnimalNFT.AnimalType.CAT, "Cat1");
        animalNFT.mintAnimal{value: dogMaxPrice}(AnimalNFT.AnimalType.DOG, "Dog1");
        animalNFT.mintAnimal{value: catMaxPrice}(AnimalNFT.AnimalType.CAT, "Cat2");
        
        uint256[] memory ownerAnimals = animalNFT.getOwnerAnimals(user1);
        assertEq(ownerAnimals.length, 3);
        assertEq(ownerAnimals[0], 1);
        assertEq(ownerAnimals[1], 2);
        assertEq(ownerAnimals[2], 3);
        
        vm.stopPrank();
    }

    function testMarketplaceListing() public {
        // User1 mint un animal
        vm.startPrank(user1);
        uint256 price = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 tokenId = animalNFT.mintAnimal{value: price}(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        // Approuver le marketplace
        animalNFT.approve(address(marketplace), tokenId);
        
        // Lister l'animal
        uint256 listingPrice = 0.1 ether;
        marketplace.listItem(tokenId, listingPrice);
        
        // Vérifier que l'animal est dans le marketplace
        assertEq(animalNFT.ownerOf(tokenId), address(marketplace));
        
        // Vérifier les détails du listing via les getters publics
        (address seller, uint256 listedPrice, bool active, ) = marketplace.listings(tokenId);
        assertEq(seller, user1);
        assertEq(listedPrice, listingPrice);
        assertTrue(active);
        
        vm.stopPrank();
        
        // User2 achète l'animal
        vm.startPrank(user2);
        marketplace.buyItem{value: listingPrice}(tokenId);
        
        // Vérifier le transfert
        assertEq(animalNFT.ownerOf(tokenId), user2);
        
        // Vérifier que le listing n'est plus actif
        (, , bool stillActive, ) = marketplace.listings(tokenId);
        assertFalse(stillActive);
        
        vm.stopPrank();
    }

    function testMarketplaceAuction() public {
        // User1 mint un animal
        vm.startPrank(user1);
        uint256 price = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 tokenId = animalNFT.mintAnimal{value: price}(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        // Approuver le marketplace
        animalNFT.approve(address(marketplace), tokenId);
        
        // Démarrer une enchère
        uint256 startingPrice = 0.05 ether;
        uint256 duration = 1 days;
        uint256 minBidIncrement = 0.01 ether;
        
        marketplace.startAuction(tokenId, startingPrice, duration, minBidIncrement);
        
        // Vérifier que l'enchère est active
        (address auctionSeller, uint256 auctionStartingPrice, , , , bool auctionActive, ) = marketplace.auctions(tokenId);
        assertEq(auctionSeller, user1);
        assertEq(auctionStartingPrice, startingPrice);
        assertTrue(auctionActive);
        
        vm.stopPrank();
        
        // User2 place une enchère
        vm.startPrank(user2);
        marketplace.placeBid{value: startingPrice}(tokenId);
        
        (, , uint256 currentBid, address currentBidder, , , ) = marketplace.auctions(tokenId);
        assertEq(currentBid, startingPrice);
        assertEq(currentBidder, user2);
        
        vm.stopPrank();
        
        // Avancer le temps pour terminer l'enchère
        vm.warp(block.timestamp + duration + 1);
        
        // Terminer l'enchère
        marketplace.endAuction(tokenId);
        
        // Vérifier le transfert
        assertEq(animalNFT.ownerOf(tokenId), user2);
        
        // Vérifier que l'enchère n'est plus active
        (, , , , , bool stillActiveAuction, ) = marketplace.auctions(tokenId);
        assertFalse(stillActiveAuction);
    }

    function testWithdrawEarnings() public {
        // Setup: User1 vend un animal à User2
        vm.startPrank(user1);
        uint256 price = animalNFT.animalTypePrices(AnimalNFT.AnimalType.CAT);
        uint256 tokenId = animalNFT.mintAnimal{value: price}(
            AnimalNFT.AnimalType.CAT,
            "Whiskers"
        );
        
        animalNFT.approve(address(marketplace), tokenId);
        uint256 listingPrice = 0.1 ether;
        marketplace.listItem(tokenId, listingPrice);
        vm.stopPrank();
        
        vm.startPrank(user2);
        marketplace.buyItem{value: listingPrice}(tokenId);
        vm.stopPrank();
        
        // User1 retire ses gains
        vm.startPrank(user1);
        uint256 balanceBefore = user1.balance;
        uint256 earnings = marketplace.sellerEarnings(user1);
        assertTrue(earnings > 0);
        
        marketplace.withdrawEarnings();
        
        uint256 balanceAfter = user1.balance;
        assertEq(balanceAfter - balanceBefore, earnings);
        assertEq(marketplace.sellerEarnings(user1), 0);
        
        vm.stopPrank();
    }

    function testOnlyOwnerFunctions() public {
        vm.startPrank(user1);
        
        // Tester que les fonctions owner-only échouent pour un non-owner
        vm.expectRevert();
        animalNFT.setBaseURI("https://newapi.com/");
        
        vm.expectRevert();
        animalNFT.updateAnimalPrice(AnimalNFT.AnimalType.CAT, 0.02 ether);
        
        vm.expectRevert();
        animalNFT.toggleMinting();
        
        vm.expectRevert();
        marketplace.setMarketplaceFee(500);
        
        vm.stopPrank();
    }

    function testMintAnimalWithTokens() public {
        vm.startPrank(user1);
        
        // Approuver le contrat AnimalNFT pour dépenser les tokens
        uint256 maxTokenPrice = animalNFT.animalTypeTokenPrices(AnimalNFT.AnimalType.TIGER) * 10;
        rewardToken.approve(address(animalNFT), maxTokenPrice);
        
        // Test mint d'un tigre avec des tokens
        uint256 tokenId = animalNFT.mintAnimalWithTokens(
            AnimalNFT.AnimalType.TIGER,
            "Shere Khan"
        );
        
        assertEq(tokenId, 1);
        assertEq(animalNFT.ownerOf(tokenId), user1);
        assertEq(animalNFT.totalSupply(), 1);
        
        // Vérifier les détails de l'animal
        AnimalNFT.Animal memory animal = animalNFT.getAnimalDetails(tokenId);
        assertEq(animal.name, "Shere Khan");
        assertEq(uint256(animal.animalType), uint256(AnimalNFT.AnimalType.TIGER));
        assertEq(animal.level, 1);
        assertEq(animal.experience, 0);
        
        vm.stopPrank();
    }

    function testMintNewAnimalTypes() public {
        vm.startPrank(user1);
        
        // Test mint d'un renard avec ETH
        uint256 foxBasePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.FOX);
        uint256 foxMaxPrice = foxBasePrice * 10;
        uint256 tokenId1 = animalNFT.mintAnimal{value: foxMaxPrice}(
            AnimalNFT.AnimalType.FOX,
            "Firefox"
        );
        
        // Test mint d'un éléphant avec ETH
        uint256 elephantBasePrice = animalNFT.animalTypePrices(AnimalNFT.AnimalType.ELEPHANT);
        uint256 elephantMaxPrice = elephantBasePrice * 10;
        uint256 tokenId2 = animalNFT.mintAnimal{value: elephantMaxPrice}(
            AnimalNFT.AnimalType.ELEPHANT,
            "Dumbo"
        );
        
        assertEq(animalNFT.totalSupply(), 2);
        
        // Vérifier les types d'animaux
        AnimalNFT.Animal memory fox = animalNFT.getAnimalDetails(tokenId1);
        AnimalNFT.Animal memory elephant = animalNFT.getAnimalDetails(tokenId2);
        
        assertEq(uint256(fox.animalType), uint256(AnimalNFT.AnimalType.FOX));
        assertEq(uint256(elephant.animalType), uint256(AnimalNFT.AnimalType.ELEPHANT));
        
        vm.stopPrank();
    }
}