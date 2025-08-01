// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../lib/openzeppelin-contracts/contracts/security/Pausable.sol";
import "../lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "../lib/openzeppelin-contracts/contracts/utils/Counters.sol";
import "../lib/openzeppelin-contracts/contracts/utils/Base64.sol";
import "../lib/openzeppelin-contracts/contracts/utils/Strings.sol";

/**
 * @title IslandAnimals - Dynamic NFT Animals for Enju Platform
 * @dev ERC721 NFTs representing animals that inhabit users' 3D islands
 * @notice Each animal represents a different blockchain ecosystem
 * 
 * Blockchain Animal Types:
 * - ETH Animals: Ethereum ecosystem animals (Lions, Bears, Eagles)
 * - NEAR Animals: NEAR Protocol ecosystem animals (Wolves, Owls, Foxes)
 * - TRON Animals: TRON ecosystem animals (Dragons, Tigers, Phoenix)
 * - Extensible for new blockchain types
 */
contract IslandAnimals is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    Ownable, 
    Pausable, 
    ReentrancyGuard 
{
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    Counters.Counter private _tokenIdCounter;
    
    // Blockchain Animal Types
    enum BlockchainType { ETH, NEAR, TRON }
    
    // Animal species for each blockchain
    struct BlockchainAnimals {
        string[] species;
        string[] colors;
        bool isActive;
    }
    
    // Animal Traits Structure
    struct AnimalTraits {
        BlockchainType blockchainType;
        string species;
        string color;
        uint256 strength; // 1-100
        uint256 agility;  // 1-100
        uint256 magic;    // 1-100
        bool isShiny;     // 5% chance for special appearance
        uint256 generation; // For future breeding mechanics
    }
    
    // Mapping for blockchain animal configurations
    mapping(BlockchainType => BlockchainAnimals) public blockchainAnimals;
    
    // Mapping for adding new blockchain types
    mapping(string => BlockchainType) public blockchainTypesByName;
    mapping(BlockchainType => string) public blockchainNames;
    uint256 public nextBlockchainTypeId = 3; // ETH=0, NEAR=1, TRON=2
    
    // Token ID to traits mapping
    mapping(uint256 => AnimalTraits) public animals;
    
    // Authorized minters (Marketplace contract)
    mapping(address => bool) public authorizedMinters;
    
    // Events
    event AnimalMinted(
        address indexed to, 
        uint256 indexed tokenId, 
        BlockchainType blockchainType,
        string species,
        bool isShiny
    );
    event MinterAuthorized(address indexed minter);
    event MinterDeauthorized(address indexed minter);
    event NewBlockchainTypeAdded(string name, BlockchainType blockchainType);
    
    constructor() ERC721("Island Animals", "ANIENU") {
        // Initialize ETH animals
        blockchainAnimals[BlockchainType.ETH].species = ["Lion", "Bear", "Eagle", "Wolf", "Tiger", "Hawk"];
        blockchainAnimals[BlockchainType.ETH].colors = ["Golden", "Brown", "Black", "Silver"];
        blockchainAnimals[BlockchainType.ETH].isActive = true;
        blockchainNames[BlockchainType.ETH] = "ETH";
        blockchainTypesByName["ETH"] = BlockchainType.ETH;
        
        // Initialize NEAR animals
        blockchainAnimals[BlockchainType.NEAR].species = ["Aurora Wolf", "Northern Owl", "Arctic Fox", "Snow Leopard", "Polar Bear", "Frost Dragon"];
        blockchainAnimals[BlockchainType.NEAR].colors = ["Ice Blue", "Crystal White", "Aurora Green", "Frost Silver"];
        blockchainAnimals[BlockchainType.NEAR].isActive = true;
        blockchainNames[BlockchainType.NEAR] = "NEAR";
        blockchainTypesByName["NEAR"] = BlockchainType.NEAR;
        
        // Initialize TRON animals
        blockchainAnimals[BlockchainType.TRON].species = ["Cyber Dragon", "Neon Tiger", "Digital Phoenix", "Tech Panther", "Quantum Falcon", "Binary Serpent"];
        blockchainAnimals[BlockchainType.TRON].colors = ["Neon Red", "Electric Blue", "Cyber Green", "Digital Gold"];
        blockchainAnimals[BlockchainType.TRON].isActive = true;
        blockchainNames[BlockchainType.TRON] = "TRON";
        blockchainTypesByName["TRON"] = BlockchainType.TRON;
    }
        string species,
        bool isShiny
    );
    event MinterAuthorized(address indexed minter);
    event MinterDeauthorized(address indexed minter);
    
    constructor() ERC721("Island Animals", "ANIENU") {}
    
    /**
     * @dev Modifier to check if caller is authorized minter
     */
    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "IslandAnimals: caller is not authorized minter");
        _;
    }
    
    /**
     * @dev Authorize an address to mint NFTs (Marketplace contract)
     * @param minter Address to authorize
     */
    function authorizeMinter(address minter) external onlyOwner {
        require(minter != address(0), "IslandAnimals: minter cannot be zero address");
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    /**
     * @dev Deauthorize a minter
     * @param minter Address to deauthorize
     */
    function deauthorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterDeauthorized(minter);
    }
    
    /**
     * @dev Mint a random animal NFT - only callable by authorized minters
     * @param to Recipient address
     * @param blockchainType Type of blockchain animal to mint
     * @param seed Random seed for trait generation
     */
    function mintBlockchainAnimal(
        address to, 
        BlockchainType blockchainType,
        uint256 seed
    ) 
        external 
        onlyMinter 
        whenNotPaused 
        nonReentrant 
        returns (uint256) 
    {
        require(to != address(0), "IslandAnimals: mint to zero address");
        require(blockchainAnimals[blockchainType].isActive, "IslandAnimals: blockchain type not active");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        // Generate random traits
        AnimalTraits memory traits = _generateBlockchainTraits(tokenId, blockchainType, seed);
        animals[tokenId] = traits;
        
        // Mint the NFT
        _safeMint(to, tokenId);
        
        // Set metadata URI
        _setTokenURI(tokenId, _generateTokenURI(tokenId, traits));
        
        emit AnimalMinted(
            to, 
            tokenId, 
            traits.blockchainType, 
            traits.species,
            traits.isShiny
        );
        
        return tokenId;
    }
    
    /**
     * @dev Generate blockchain-specific traits for an animal
     * @param tokenId Token ID for additional randomness
     * @param blockchainType Type of blockchain animal
     * @param seed Random seed
     */
    function _generateBlockchainTraits(
        uint256 tokenId, 
        BlockchainType blockchainType,
        uint256 seed
    ) 
        private 
        view 
        returns (AnimalTraits memory) 
    {
        // Create pseudo-random number from multiple sources
        uint256 randomness = uint256(keccak256(abi.encodePacked(
            seed,
            tokenId,
            block.timestamp,
            block.prevrandao,
            msg.sender
        )));
        
        BlockchainAnimals storage blockchainData = blockchainAnimals[blockchainType];
        
        // Select random species and color
        string memory species = blockchainData.species[randomness % blockchainData.species.length];
        string memory color = blockchainData.colors[(randomness >> 8) % blockchainData.colors.length];
        
        // Generate stats (50-100 range for all blockchain animals)
        uint256 strength = 50 + ((randomness >> 16) % 51);
        uint256 agility = 50 + ((randomness >> 24) % 51);
        uint256 magic = 50 + ((randomness >> 32) % 51);
        
        // 5% chance for shiny variant
        bool isShiny = ((randomness >> 40) % 100) < 5;
        
        return AnimalTraits({
            blockchainType: blockchainType,
            species: species,
            color: color,
            strength: strength,
            agility: agility,
            magic: magic,
            isShiny: isShiny,
            generation: 1
        });
    }
    
    /**
     * @dev Add a new blockchain type with animals
     * @param name Blockchain name (e.g., "POLYGON", "BSC")
     * @param species Array of animal species for this blockchain
     * @param colors Array of colors for this blockchain
     */
    function addBlockchainType(
        string calldata name,
        string[] calldata species,
        string[] calldata colors
    ) external onlyOwner {
        require(bytes(name).length > 0, "IslandAnimals: name cannot be empty");
        require(species.length > 0, "IslandAnimals: must have at least one species");
        require(colors.length > 0, "IslandAnimals: must have at least one color");
        require(blockchainTypesByName[name] == BlockchainType(0) || 
                keccak256(bytes(blockchainNames[blockchainTypesByName[name]])) != keccak256(bytes(name)), 
                "IslandAnimals: blockchain type already exists");
        
        BlockchainType newType = BlockchainType(nextBlockchainTypeId);
        nextBlockchainTypeId++;
        
        blockchainAnimals[newType].species = species;
        blockchainAnimals[newType].colors = colors;
        blockchainAnimals[newType].isActive = true;
        
        blockchainNames[newType] = name;
        blockchainTypesByName[name] = newType;
        
        emit NewBlockchainTypeAdded(name, newType);
    }
    
    /**
     * @dev Update animals for existing blockchain type
     * @param blockchainType The blockchain type to update
     * @param species New array of animal species
     * @param colors New array of colors
     */
    function updateBlockchainAnimals(
        BlockchainType blockchainType,
        string[] calldata species,
        string[] calldata colors
    ) external onlyOwner {
        require(species.length > 0, "IslandAnimals: must have at least one species");
        require(colors.length > 0, "IslandAnimals: must have at least one color");
        
        blockchainAnimals[blockchainType].species = species;
        blockchainAnimals[blockchainType].colors = colors;
    }
    
    /**
     * @dev Toggle blockchain type active status
     * @param blockchainType The blockchain type to toggle
     */
    function toggleBlockchainType(BlockchainType blockchainType) external onlyOwner {
        blockchainAnimals[blockchainType].isActive = !blockchainAnimals[blockchainType].isActive;
    }
    
    /**
     * @dev Get blockchain type by name
     * @param name Blockchain name
     */
    function getBlockchainTypeByName(string calldata name) external view returns (BlockchainType) {
        return blockchainTypesByName[name];
    }
    
    /**
     * @dev Get available species for a blockchain type
     * @param blockchainType The blockchain type
     */
    function getBlockchainSpecies(BlockchainType blockchainType) external view returns (string[] memory) {
        return blockchainAnimals[blockchainType].species;
    }
    
    /**
     * @dev Get available colors for a blockchain type
     * @param blockchainType The blockchain type
     */
    function getBlockchainColors(BlockchainType blockchainType) external view returns (string[] memory) {
        return blockchainAnimals[blockchainType].colors;
    }
    function _selectSpecies(AnimalType animalType, uint256 randomness) 
        private 
        view 
        returns (string memory) 
    {
        if (animalType == AnimalType.LAND) {
            return landAnimals[randomness % landAnimals.length];
        } else if (animalType == AnimalType.SEA) {
            return seaAnimals[randomness % seaAnimals.length];
        } else if (animalType == AnimalType.SKY) {
            return skyAnimals[randomness % skyAnimals.length];
        } else {
            return mythicalAnimals[randomness % mythicalAnimals.length];
        }
    }
    
    /**
     * @dev Generate JSON metadata for token URI
     */
    function _generateTokenURI(uint256 tokenId, AnimalTraits memory traits) 
        private 
        view
        returns (string memory) 
    {
        string memory blockchainStr = blockchainNames[traits.blockchainType];
        
        // Build attributes array
        string memory attributes = string(abi.encodePacked(
            '[',
            '{"trait_type":"Species","value":"', traits.species, '"},',
            '{"trait_type":"Blockchain","value":"', blockchainStr, '"},',
            '{"trait_type":"Color","value":"', traits.color, '"},',
            '{"trait_type":"Strength","value":', traits.strength.toString(), '},',
            '{"trait_type":"Agility","value":', traits.agility.toString(), '},',
            '{"trait_type":"Magic","value":', traits.magic.toString(), '},',
            '{"trait_type":"Generation","value":', traits.generation.toString(), '},',
            '{"trait_type":"Shiny","value":"', traits.isShiny ? 'Yes' : 'No', '"}',
            ']'
        ));
        
        string memory json = string(abi.encodePacked(
            '{',
            '"name":"', traits.color, ' ', traits.species, traits.isShiny ? ' ✨' : '', '",',
            '"description":"A ', traits.color, ' ', traits.species, ' from the ', blockchainStr, ' ecosystem. This blockchain animal lives on your Enju island and represents the power of ', blockchainStr, ' network.",',
            '"image":"https://enju-nft-images.com/', blockchainStr, '/', traits.species, '/', traits.color, traits.isShiny ? '_shiny' : '', '.png",',
            '"attributes":', attributes,
            '}'
        ));
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }
    
    /**
     * @dev Get animal details by token ID
     * @param tokenId Token ID to query
     */
    function getAnimal(uint256 tokenId) external view returns (AnimalTraits memory) {
        require(_exists(tokenId), "IslandAnimals: token does not exist");
        return animals[tokenId];
    }
    
    /**
     * @dev Get all animals owned by an address
     * @param owner Address to query
     */
    function getAnimalsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Get animal traits by token ID
     */
    function getAnimal(uint256 tokenId) external view returns (AnimalTraits memory) {
        require(_exists(tokenId), "IslandAnimals: token does not exist");
        return animals[tokenId];
    }
    
    /**
     * @dev Get all animals owned by an address
     * @param owner Address to query
     */
    function getAnimalsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory animalIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            animalIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return animalIds;
    }
    
    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get total number of minted animals
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    // Override required functions
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
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
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
