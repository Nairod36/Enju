// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./RewardToken.sol";
import "./AnimalTypeFactory.sol";

/**
 * @title AnimalNFT
 * @dev Contract pour les NFT d'animaux qui peuvent être achetés dans le mini marketplace
 * Les animaux ont différentes raretés et caractéristiques
 */
contract AnimalNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    using Strings for uint256;

    // Structure pour définir un animal
    struct Animal {
        string name;
        uint256 animalTypeId; // ID du type d'animal dans la factory
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

    // Niveaux de rareté
    enum Rarity {
        COMMON,     // Commun - 60%
        UNCOMMON,   // Peu commun - 25%
        RARE,       // Rare - 10%
        EPIC,       // Épique - 4%
        LEGENDARY   // Légendaire - 1%
    }

    // Mappings
    mapping(uint256 => Animal) public animals;
    mapping(Rarity => uint256) public rarityMultipliers;
    
    // Événements
    event AnimalMinted(address indexed owner, uint256 indexed tokenId, uint256 animalTypeId, Rarity rarity);
    event AnimalFed(uint256 indexed tokenId, uint256 experienceGained);
    event AnimalLevelUp(uint256 indexed tokenId, uint256 newLevel);
    event BreedingStarted(uint256 indexed parent1, uint256 indexed parent2);
    event BreedingCompleted(uint256 indexed newTokenId, uint256 indexed parent1, uint256 indexed parent2);

    // Variables d'état
    uint256 private _nextTokenId = 1;
    uint256 public constant BREEDING_COOLDOWN = 7 days;
    uint256 public constant FEED_COOLDOWN = 8 hours;
    uint256 public constant MAX_LEVEL = 100;
    bool public mintingPaused = false;
    
    // Contracts
    RewardToken public rewardToken;
    AnimalTypeFactory public animalTypeFactory;

    constructor(address initialOwner, address _rewardToken, address _animalTypeFactory) 
        ERC721("Enju Animals", "ENJU") 
        Ownable(initialOwner)
    {
        rewardToken = RewardToken(_rewardToken);
        animalTypeFactory = AnimalTypeFactory(_animalTypeFactory);
        _initializeRarityMultipliers();
    }


    /**
     * @dev Initialise les multiplicateurs de rareté
     */
    function _initializeRarityMultipliers() private {
        rarityMultipliers[Rarity.COMMON] = 100;      // x1.0
        rarityMultipliers[Rarity.UNCOMMON] = 150;    // x1.5
        rarityMultipliers[Rarity.RARE] = 300;        // x3.0
        rarityMultipliers[Rarity.EPIC] = 500;        // x5.0
        rarityMultipliers[Rarity.LEGENDARY] = 1000;  // x10.0
    }


    /**
     * @dev Mint un nouvel animal avec des RewardTokens
     */
    function mintAnimal(uint256 _animalTypeId, string memory _name) 
        external 
        returns (uint256) 
    {
        require(!mintingPaused, "Minting is currently paused");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_name).length <= 20, "Name too long");
        require(animalTypeFactory.isAnimalTypeActive(_animalTypeId), "Animal type not active");

        // Déterminer la rareté de manière pseudo-aléatoire
        Rarity rarity = _determineRarity();
        
        // Calculer le prix basé sur le type d'animal et la rareté
        uint256 tokenPrice = _calculateTokenPrice(_animalTypeId, rarity);
        
        // Transférer les tokens depuis l'utilisateur vers le contrat
        require(rewardToken.transferFrom(msg.sender, address(this), tokenPrice), "Token transfer failed");

        uint256 tokenId = _nextTokenId++;
        
        // Créer l'animal avec des stats de base aléatoires
        animals[tokenId] = Animal({
            name: _name,
            animalTypeId: _animalTypeId,
            rarity: rarity,
            level: 1,
            experience: 0,
            strength: _generateBaseStat(rarity),
            agility: _generateBaseStat(rarity),
            intelligence: _generateBaseStat(rarity),
            isBreeding: false,
            lastFeedTime: 0,
            birthTime: block.timestamp
        });

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));

        emit AnimalMinted(msg.sender, tokenId, _animalTypeId, rarity);

        return tokenId;
    }

    /**
     * @dev Nourrit un animal pour lui donner de l'expérience
     */
    function feedAnimal(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not the owner");
        require(animals[tokenId].lastFeedTime + FEED_COOLDOWN <= block.timestamp, "Still in cooldown");
        
        Animal storage animal = animals[tokenId];
        animal.lastFeedTime = block.timestamp;
        
        // Gain d'expérience basé sur la rareté
        uint256 expGain = 10 + (uint256(animal.rarity) * 5);
        animal.experience += expGain;
        
        emit AnimalFed(tokenId, expGain);
        
        // Vérifier si level up
        _checkLevelUp(tokenId);
    }

    /**
     * @dev Vérifie et effectue un level up si nécessaire
     */
    function _checkLevelUp(uint256 tokenId) private {
        Animal storage animal = animals[tokenId];
        uint256 requiredExp = animal.level * 100; // 100 exp par niveau
        
        if (animal.experience >= requiredExp && animal.level < MAX_LEVEL) {
            animal.level++;
            animal.experience = 0; // Reset l'expérience pour le prochain niveau
            
            // Augmenter les stats avec le niveau
            animal.strength += _generateStatIncrease();
            animal.agility += _generateStatIncrease();
            animal.intelligence += _generateStatIncrease();
            
            emit AnimalLevelUp(tokenId, animal.level);
        }
    }

    /**
     * @dev Détermine la rareté de manière pseudo-aléatoire
     */
    function _determineRarity() private view returns (Rarity) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            _nextTokenId
        ))) % 100;

        if (random < 60) return Rarity.COMMON;      // 60%
        if (random < 85) return Rarity.UNCOMMON;    // 25%
        if (random < 95) return Rarity.RARE;        // 10%
        if (random < 99) return Rarity.EPIC;        // 4%
        return Rarity.LEGENDARY;                     // 1%
    }

    /**
     * @dev Calcule le prix en tokens d'un animal basé sur son type et sa rareté
     */
    function _calculateTokenPrice(uint256 _animalTypeId, Rarity _rarity) private view returns (uint256) {
        AnimalTypeFactory.AnimalTypeData memory animalType = animalTypeFactory.getAnimalType(_animalTypeId);
        uint256 basePrice = animalType.basePrice;
        uint256 multiplier = rarityMultipliers[_rarity];
        return (basePrice * multiplier) / 100;
    }

    /**
     * @dev Génère une stat de base aléatoire basée sur la rareté
     */
    function _generateBaseStat(Rarity _rarity) private view returns (uint256) {
        uint256 baseStat = 10 + (uint256(_rarity) * 5);
        uint256 randomBonus = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _nextTokenId
        ))) % 10;
        return baseStat + randomBonus;
    }

    /**
     * @dev Génère une augmentation de stat pour le level up
     */
    function _generateStatIncrease() private view returns (uint256) {
        return 1 + (uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao
        ))) % 3); // +1 à +3
    }

    /**
     * @dev Génère l'URI du token avec métadonnées 3D
     */
    function _generateTokenURI(uint256 tokenId) private view returns (string memory) {
        Animal memory animal = animals[tokenId];
        return animalTypeFactory.generateMetadataURI(
            animal.animalTypeId,
            tokenId,
            animal.name,
            animal.level,
            uint256(animal.rarity)
        );
    }

    /**
     * @dev Retourne les détails complets d'un animal
     */
    function getAnimalDetails(uint256 tokenId) external view returns (Animal memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return animals[tokenId];
    }

    /**
     * @dev Retourne tous les animaux d'un propriétaire
     */
    function getOwnerAnimals(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }

    /**
     * @dev Retourne le prix en tokens pour un type d'animal et une rareté donnée
     */
    function getPrice(uint256 _animalTypeId, Rarity _rarity) external view returns (uint256) {
        return _calculateTokenPrice(_animalTypeId, _rarity);
    }

    /**
     * @dev Retourne tous les types d'animaux actifs
     */
    function getActiveAnimalTypes() external view returns (uint256[] memory typeIds, AnimalTypeFactory.AnimalTypeData[] memory types) {
        return animalTypeFactory.getActiveAnimalTypes();
    }

    /**
     * @dev Met à jour l'adresse de la factory (uniquement le propriétaire)
     */
    function setAnimalTypeFactory(address _newFactory) external onlyOwner {
        animalTypeFactory = AnimalTypeFactory(_newFactory);
    }

    /**
     * @dev Pause/reprend le minting
     */
    function toggleMinting() external onlyOwner {
        mintingPaused = !mintingPaused;
    }

    /**
     * @dev Retire les RewardTokens du contrat
     */
    function withdrawTokens() external onlyOwner {
        uint256 balance = rewardToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(rewardToken.transfer(owner(), balance), "Token transfer failed");
    }

    // Overrides requis pour la compatibilité
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}