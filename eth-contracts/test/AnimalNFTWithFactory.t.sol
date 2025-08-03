// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AnimalNFT.sol";
import "../src/AnimalMarketplace.sol";
import "../src/RewardToken.sol";
import "../src/AnimalTypeFactory.sol";

contract AnimalNFTWithFactoryTest is Test {
    AnimalNFT public animalNFT;
    AnimalMarketplace public marketplace;
    RewardToken public rewardToken;
    AnimalTypeFactory public animalTypeFactory;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        
        // Déployer les contrats dans l'ordre
        rewardToken = new RewardToken("Test Reward", "TREWARD", owner);
        animalTypeFactory = new AnimalTypeFactory(owner);
        animalNFT = new AnimalNFT(owner, address(rewardToken), address(animalTypeFactory));
        marketplace = new AnimalMarketplace(address(animalNFT), address(rewardToken), owner);
        
        vm.stopPrank();
        
        // Donner des RewardTokens aux utilisateurs de test
        vm.startPrank(owner);
        rewardToken.transfer(user1, 1000 * 10**18);
        rewardToken.transfer(user2, 1000 * 10**18);
        vm.stopPrank();
    }

    function testFactoryDefaultAnimalTypes() public {
        // Vérifier que la factory a été initialisée avec les types d'animaux par défaut
        uint256 animalCount = animalTypeFactory.getAnimalTypeCount();
        assertEq(animalCount, 11); // 11 types d'animaux par défaut

        // Vérifier quelques types spécifiques
        AnimalTypeFactory.AnimalTypeData memory cat = animalTypeFactory.getAnimalType(0);
        assertEq(cat.name, "Cat");
        assertEq(cat.basePrice, 10 * 10**18);
        assertTrue(cat.isActive);

        AnimalTypeFactory.AnimalTypeData memory tiger = animalTypeFactory.getAnimalType(5);
        assertEq(tiger.name, "Tiger");
        assertEq(tiger.basePrice, 25 * 10**18);
        assertTrue(tiger.isActive);
    }

    function testMintAnimalWithFactoryTypes() public {
        vm.startPrank(user1);
        
        // Approuver les tokens pour le mint
        uint256 approvalAmount = 500 * 10**18;
        rewardToken.approve(address(animalNFT), approvalAmount);
        
        // Mint un chat (type ID 0)
        uint256 catTokenId = animalNFT.mintAnimal(0, "Whiskers");
        assertEq(catTokenId, 1);
        assertEq(animalNFT.ownerOf(catTokenId), user1);
        
        // Vérifier les détails de l'animal
        AnimalNFT.Animal memory cat = animalNFT.getAnimalDetails(catTokenId);
        assertEq(cat.name, "Whiskers");
        assertEq(cat.animalTypeId, 0);
        assertEq(cat.level, 1);
        
        // Mint un tigre (type ID 5)
        uint256 tigerTokenId = animalNFT.mintAnimal(5, "Shere Khan");
        assertEq(tigerTokenId, 2);
        
        AnimalNFT.Animal memory tiger = animalNFT.getAnimalDetails(tigerTokenId);
        assertEq(tiger.name, "Shere Khan");
        assertEq(tiger.animalTypeId, 5);
        
        vm.stopPrank();
    }

    function testPriceCalculationWithRarity() public view {
        // Vérifier les prix calculés pour différentes raretés
        uint256 catCommonPrice = animalNFT.getPrice(0, AnimalNFT.Rarity.COMMON);
        uint256 catRarePrice = animalNFT.getPrice(0, AnimalNFT.Rarity.RARE);
        uint256 catLegendaryPrice = animalNFT.getPrice(0, AnimalNFT.Rarity.LEGENDARY);
        
        // Prix de base du chat: 10 REWARD
        assertEq(catCommonPrice, 10 * 10**18);      // x1.0
        assertEq(catRarePrice, 30 * 10**18);        // x3.0
        assertEq(catLegendaryPrice, 100 * 10**18);  // x10.0
    }

    function testAddNewAnimalType() public {
        vm.startPrank(owner);
        
        // Ajouter un nouveau type d'animal via la factory
        uint256 newTypeId = animalTypeFactory.addAnimalType(
            "Griffin",
            "Un griffin majestueux avec des ailes d'aigle",
            "QmGriffinModel3D...",
            "QmGriffinImage...",
            75 * 10**18 // 75 REWARD
        );
        
        assertEq(newTypeId, 11); // Devrait être le 12e type (index 11)
        
        // Vérifier que le nouveau type existe
        AnimalTypeFactory.AnimalTypeData memory griffin = animalTypeFactory.getAnimalType(newTypeId);
        assertEq(griffin.name, "Griffin");
        assertEq(griffin.basePrice, 75 * 10**18);
        assertTrue(griffin.isActive);
        
        vm.stopPrank();
        
        // Tester le mint du nouveau type
        vm.startPrank(user1);
        rewardToken.approve(address(animalNFT), 500 * 10**18);
        
        uint256 griffinTokenId = animalNFT.mintAnimal(newTypeId, "Gryff");
        AnimalNFT.Animal memory griffinAnimal = animalNFT.getAnimalDetails(griffinTokenId);
        assertEq(griffinAnimal.animalTypeId, newTypeId);
        assertEq(griffinAnimal.name, "Gryff");
        
        vm.stopPrank();
    }

    function testMetadataURIGeneration() public {
        vm.startPrank(user1);
        
        // Approuver et mint un animal
        rewardToken.approve(address(animalNFT), 100 * 10**18);
        uint256 tokenId = animalNFT.mintAnimal(0, "TestCat");
        
        // Vérifier que l'URI est généré correctement
        string memory tokenURI = animalNFT.tokenURI(tokenId);
        
        // L'URI devrait contenir les informations de l'animal et les hashes 3D
        // Format attendu: https://api.enju.com/metadata/animal/{tokenId}?type={typeId}&name={name}&level={level}&rarity={rarity}&model3d={hash}&image={hash}
        assertTrue(bytes(tokenURI).length > 0);
        
        vm.stopPrank();
    }

    function testGetActiveAnimalTypes() public view {
        (uint256[] memory typeIds, AnimalTypeFactory.AnimalTypeData[] memory types) = animalNFT.getActiveAnimalTypes();
        
        assertEq(typeIds.length, 11); // 11 types d'animaux actifs par défaut
        assertEq(types.length, 11);
        
        // Vérifier que tous les types retournés sont actifs
        for (uint256 i = 0; i < types.length; i++) {
            assertTrue(types[i].isActive);
        }
    }

    function testAnimalTypeActivation() public {
        vm.startPrank(owner);
        
        // Désactiver le type tigre (ID 5)
        animalTypeFactory.setAnimalTypeStatus(5, false);
        
        vm.stopPrank();
        
        // Vérifier qu'on ne peut plus mint ce type
        vm.startPrank(user1);
        rewardToken.approve(address(animalNFT), 100 * 10**18);
        
        vm.expectRevert("Animal type not active");
        animalNFT.mintAnimal(5, "Disabled Tiger");
        
        vm.stopPrank();
        
        // Réactiver et vérifier qu'on peut mint à nouveau
        vm.startPrank(owner);
        animalTypeFactory.setAnimalTypeStatus(5, true);
        vm.stopPrank();
        
        vm.startPrank(user1);
        uint256 tokenId = animalNFT.mintAnimal(5, "Active Tiger");
        assertEq(animalNFT.ownerOf(tokenId), user1);
        vm.stopPrank();
    }

    function testMarketplaceWithFactoryAnimals() public {
        // User1 mint un animal avec la factory
        vm.startPrank(user1);
        rewardToken.approve(address(animalNFT), 100 * 10**18);
        uint256 tokenId = animalNFT.mintAnimal(5, "MarketTiger"); // Tigre
        
        // Lister l'animal sur le marketplace
        animalNFT.approve(address(marketplace), tokenId);
        uint256 listingPrice = 50 * 10**18; // 50 REWARD
        marketplace.listItem(tokenId, listingPrice);
        
        assertEq(animalNFT.ownerOf(tokenId), address(marketplace));
        vm.stopPrank();
        
        // User2 achète l'animal
        vm.startPrank(user2);
        rewardToken.approve(address(marketplace), listingPrice);
        marketplace.buyItem(tokenId);
        
        assertEq(animalNFT.ownerOf(tokenId), user2);
        vm.stopPrank();
    }

    function testUpdateAnimalTypeMetadata() public {
        vm.startPrank(owner);
        
        // Mettre a jour les metadonnees du chat (ID 0)
        animalTypeFactory.updateAnimalType(
            0,
            "Un chat domestique tres mignon avec de nouvelles fonctionnalites",
            "QmNewCatModel3D...",
            "QmNewCatImage..."
        );
        
        // Verifier que les metadonnees ont ete mises a jour
        AnimalTypeFactory.AnimalTypeData memory updatedCat = animalTypeFactory.getAnimalType(0);
        assertEq(updatedCat.model3DHash, "QmNewCatModel3D...");
        assertEq(updatedCat.imageHash, "QmNewCatImage...");
        
        vm.stopPrank();
    }

    function testFeedAnimalAndLevelUp() public {
        vm.startPrank(user1);
        
        // Mint un animal
        rewardToken.approve(address(animalNFT), 100 * 10**18);
        uint256 tokenId = animalNFT.mintAnimal(0, "LevelCat");
        
        // Avancer le temps pour eviter le cooldown
        vm.warp(block.timestamp + 8 hours + 1);
        
        // Nourrir l'animal
        animalNFT.feedAnimal(tokenId);
        
        AnimalNFT.Animal memory animal = animalNFT.getAnimalDetails(tokenId);
        assertTrue(animal.experience > 0);
        assertTrue(animal.lastFeedTime > 0);
        
        vm.stopPrank();
    }

    function testInvalidAnimalTypeId() public {
        vm.startPrank(user1);
        rewardToken.approve(address(animalNFT), 100 * 10**18);
        
        // Essayer de mint avec un ID d'animal qui n'existe pas
        vm.expectRevert("Animal type not active");
        animalNFT.mintAnimal(999, "InvalidAnimal");
        
        vm.stopPrank();
    }

    function testOnlyOwnerFactoryFunctions() public {
        vm.startPrank(user1);
        
        // Verifier que les fonctions owner-only echouent pour un non-owner
        vm.expectRevert();
        animalTypeFactory.addAnimalType("Unauthorized", "desc", "hash1", "hash2", 100);
        
        vm.expectRevert();
        animalTypeFactory.setAnimalTypeStatus(0, false);
        
        vm.expectRevert();
        animalTypeFactory.updateAnimalTypePrice(0, 200 * 10**18);
        
        vm.stopPrank();
    }
}