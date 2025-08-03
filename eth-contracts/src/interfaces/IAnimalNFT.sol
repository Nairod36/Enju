// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IAnimalNFT
 * @dev Interface pour le contrat AnimalNFT
 * Facilite l'intégration avec d'autres contrats et le frontend
 */
interface IAnimalNFT is IERC721 {
    
    enum AnimalType {
        CAT,
        DOG,
        BIRD,
        FISH,
        RABBIT,
        TIGER,
        FOX,
        ELEPHANT,
        DRAGON,
        UNICORN,
        PHOENIX
    }

    enum Rarity {
        COMMON,
        UNCOMMON,
        RARE,
        EPIC,
        LEGENDARY
    }

    struct Animal {
        string name;
        AnimalType animalType;
        Rarity rarity;
        uint256 level;
        uint256 experience;
        uint256 strength;
        uint256 agility;
        uint256 intelligence;
        bool isBreeding;
        uint256 lastFeedTime;
        uint256 birthTime;
    }

    // Events
    event AnimalMinted(address indexed owner, uint256 indexed tokenId, AnimalType animalType, Rarity rarity);
    event AnimalFed(uint256 indexed tokenId, uint256 experienceGained);
    event AnimalLevelUp(uint256 indexed tokenId, uint256 newLevel);
    event BreedingStarted(uint256 indexed parent1, uint256 indexed parent2);
    event BreedingCompleted(uint256 indexed newTokenId, uint256 indexed parent1, uint256 indexed parent2);

    // Core functions
    function mintAnimal(AnimalType _animalType, string memory _name) external returns (uint256);
    function feedAnimal(uint256 tokenId) external;
    function getAnimalDetails(uint256 tokenId) external view returns (Animal memory);
    function getOwnerAnimals(address owner) external view returns (uint256[] memory);
    
    // Price and configuration
    function animalTypeTokenPrices(AnimalType animalType) external view returns (uint256);
    function rarityMultipliers(Rarity rarity) external view returns (uint256);
    function getPrice(AnimalType _animalType, Rarity _rarity) external view returns (uint256);
    function mintingPaused() external view returns (bool);
    
    // Admin functions
    function setBaseURI(string memory newBaseURI) external;
    function updateAnimalPrice(AnimalType _animalType, uint256 _newPrice) external;
    function toggleMinting() external;
    function withdrawTokens() external;
}