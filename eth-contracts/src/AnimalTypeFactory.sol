// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AnimalTypeFactory
 * @dev Factory pour gérer les types d'animaux et leurs métadonnées
 * Permet d'ajouter de nouveaux types d'animaux dynamiquement
 */
contract AnimalTypeFactory is Ownable {
    
    // Structure pour définir un type d'animal
    struct AnimalTypeData {
        string name;           // Nom de l'animal (ex: "Tiger", "Fox")
        string description;    // Description de l'animal
        string model3DHash;    // Hash IPFS du modèle 3D
        string imageHash;      // Hash IPFS de l'image de prévisualisation
        uint256 basePrice;     // Prix de base en RewardTokens
        bool isActive;         // Si le type est disponible au mint
        uint256 createdAt;     // Timestamp de création
    }

    // Mapping des types d'animaux par ID
    mapping(uint256 => AnimalTypeData) public animalTypes;
    
    // Compteur pour les IDs des types d'animaux
    uint256 public nextAnimalTypeId = 0;
    
    // Mapping pour vérifier l'unicité des noms
    mapping(string => bool) public nameExists;
    
    // Événements
    event AnimalTypeCreated(uint256 indexed typeId, string name, uint256 basePrice);
    event AnimalTypeUpdated(uint256 indexed typeId, string name);
    event AnimalTypeStatusChanged(uint256 indexed typeId, bool isActive);
    event AnimalTypePriceChanged(uint256 indexed typeId, uint256 newPrice);

    constructor(address initialOwner) Ownable(initialOwner) {
        _createDefaultAnimalTypes();
    }

    /**
     * @dev Crée les types d'animaux par défaut
     */
    function _createDefaultAnimalTypes() private {
        // Chat
        _createAnimalType(
            "Cat",
            "Un chat domestique adorable et joueur",
            "QmCatModel3D...", // À remplacer par le vrai hash IPFS
            "QmCatImage...",   // À remplacer par le vrai hash IPFS
            10 * 10**18       // 10 REWARD
        );
        
        // Chien  
        _createAnimalType(
            "Dog",
            "Un chien loyal et énergique, meilleur ami de l'homme",
            "QmDogModel3D...",
            "QmDogImage...",
            10 * 10**18
        );
        
        // Oiseau
        _createAnimalType(
            "Bird", 
            "Un oiseau coloré capable de voler haut dans le ciel",
            "QmBirdModel3D...",
            "QmBirdImage...",
            15 * 10**18
        );
        
        // Poisson
        _createAnimalType(
            "Fish",
            "Un poisson gracieux nageant dans les eaux cristallines", 
            "QmFishModel3D...",
            "QmFishImage...",
            8 * 10**18
        );
        
        // Lapin
        _createAnimalType(
            "Rabbit",
            "Un lapin rapide avec de longues oreilles",
            "QmRabbitModel3D...",
            "QmRabbitImage...", 
            12 * 10**18
        );

        // Tigre
        _createAnimalType(
            "Tiger",
            "Un tigre majestueux avec des rayures distinctives",
            "QmTigerModel3D...",
            "QmTigerImage...",
            25 * 10**18
        );

        // Renard
        _createAnimalType(
            "Fox", 
            "Un renard rusé avec une queue touffue",
            "QmFoxModel3D...",
            "QmFoxImage...",
            18 * 10**18
        );

        // Éléphant
        _createAnimalType(
            "Elephant",
            "Un éléphant imposant avec une mémoire exceptionnelle", 
            "QmElephantModel3D...",
            "QmElephantImage...",
            35 * 10**18
        );

        // Dragon (rare)
        _createAnimalType(
            "Dragon",
            "Un dragon légendaire cracheur de feu",
            "QmDragonModel3D...",
            "QmDragonImage...",
            100 * 10**18
        );

        // Licorne (très rare)
        _createAnimalType(
            "Unicorn",
            "Une licorne magique avec une corne scintillante",
            "QmUnicornModel3D...",
            "QmUnicornImage...",
            150 * 10**18
        );

        // Phénix (légendaire)
        _createAnimalType(
            "Phoenix",
            "Un phénix immortel renaissant de ses cendres",
            "QmPhoenixModel3D...",
            "QmPhoenixImage...",
            500 * 10**18
        );
    }

    /**
     * @dev Crée un nouveau type d'animal
     */
    function _createAnimalType(
        string memory _name,
        string memory _description,
        string memory _model3DHash,
        string memory _imageHash,
        uint256 _basePrice
    ) private {
        uint256 typeId = nextAnimalTypeId++;
        
        animalTypes[typeId] = AnimalTypeData({
            name: _name,
            description: _description,
            model3DHash: _model3DHash,
            imageHash: _imageHash,
            basePrice: _basePrice,
            isActive: true,
            createdAt: block.timestamp
        });
        
        nameExists[_name] = true;
        
        emit AnimalTypeCreated(typeId, _name, _basePrice);
    }

    /**
     * @dev Ajoute un nouveau type d'animal (seulement le propriétaire)
     */
    function addAnimalType(
        string memory _name,
        string memory _description,
        string memory _model3DHash,
        string memory _imageHash,
        uint256 _basePrice
    ) external onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(!nameExists[_name], "Name already exists");
        require(_basePrice > 0, "Price must be greater than 0");
        require(bytes(_model3DHash).length > 0, "Model3D hash cannot be empty");
        require(bytes(_imageHash).length > 0, "Image hash cannot be empty");
        
        uint256 typeId = nextAnimalTypeId++;
        
        animalTypes[typeId] = AnimalTypeData({
            name: _name,
            description: _description,
            model3DHash: _model3DHash,
            imageHash: _imageHash,
            basePrice: _basePrice,
            isActive: true,
            createdAt: block.timestamp
        });
        
        nameExists[_name] = true;
        
        emit AnimalTypeCreated(typeId, _name, _basePrice);
        
        return typeId;
    }

    /**
     * @dev Met à jour les métadonnées d'un type d'animal
     */
    function updateAnimalType(
        uint256 _typeId,
        string memory _description,
        string memory _model3DHash,
        string memory _imageHash
    ) external onlyOwner {
        require(_typeId < nextAnimalTypeId, "Animal type does not exist");
        require(bytes(_model3DHash).length > 0, "Model3D hash cannot be empty");
        require(bytes(_imageHash).length > 0, "Image hash cannot be empty");
        
        AnimalTypeData storage animalType = animalTypes[_typeId];
        animalType.description = _description;
        animalType.model3DHash = _model3DHash;
        animalType.imageHash = _imageHash;
        
        emit AnimalTypeUpdated(_typeId, animalType.name);
    }

    /**
     * @dev Met à jour le prix d'un type d'animal
     */
    function updateAnimalTypePrice(uint256 _typeId, uint256 _newPrice) external onlyOwner {
        require(_typeId < nextAnimalTypeId, "Animal type does not exist");
        require(_newPrice > 0, "Price must be greater than 0");
        
        animalTypes[_typeId].basePrice = _newPrice;
        
        emit AnimalTypePriceChanged(_typeId, _newPrice);
    }

    /**
     * @dev Active/désactive un type d'animal
     */
    function setAnimalTypeStatus(uint256 _typeId, bool _isActive) external onlyOwner {
        require(_typeId < nextAnimalTypeId, "Animal type does not exist");
        
        animalTypes[_typeId].isActive = _isActive;
        
        emit AnimalTypeStatusChanged(_typeId, _isActive);
    }

    /**
     * @dev Retourne les données d'un type d'animal
     */
    function getAnimalType(uint256 _typeId) external view returns (AnimalTypeData memory) {
        require(_typeId < nextAnimalTypeId, "Animal type does not exist");
        return animalTypes[_typeId];
    }

    /**
     * @dev Retourne tous les types d'animaux actifs
     */
    function getActiveAnimalTypes() external view returns (uint256[] memory typeIds, AnimalTypeData[] memory types) {
        // Première passe pour compter les types actifs
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nextAnimalTypeId; i++) {
            if (animalTypes[i].isActive) {
                activeCount++;
            }
        }
        
        // Allouer les tableaux
        typeIds = new uint256[](activeCount);
        types = new AnimalTypeData[](activeCount);
        
        // Deuxième passe pour remplir les tableaux
        uint256 index = 0;
        for (uint256 i = 0; i < nextAnimalTypeId; i++) {
            if (animalTypes[i].isActive) {
                typeIds[index] = i;
                types[index] = animalTypes[i];
                index++;
            }
        }
    }

    /**
     * @dev Retourne tous les types d'animaux (actifs et inactifs)
     */
    function getAllAnimalTypes() external view returns (uint256[] memory typeIds, AnimalTypeData[] memory types) {
        typeIds = new uint256[](nextAnimalTypeId);
        types = new AnimalTypeData[](nextAnimalTypeId);
        
        for (uint256 i = 0; i < nextAnimalTypeId; i++) {
            typeIds[i] = i;
            types[i] = animalTypes[i];
        }
    }

    /**
     * @dev Vérifie si un type d'animal existe et est actif
     */
    function isAnimalTypeActive(uint256 _typeId) external view returns (bool) {
        if (_typeId >= nextAnimalTypeId) {
            return false;
        }
        return animalTypes[_typeId].isActive;
    }

    /**
     * @dev Retourne le nombre total de types d'animaux
     */
    function getAnimalTypeCount() external view returns (uint256) {
        return nextAnimalTypeId;
    }

    /**
     * @dev Génère l'URI des métadonnées pour un animal spécifique
     */
    function generateMetadataURI(
        uint256 _typeId,
        uint256 _tokenId,
        string memory _name,
        uint256 _level,
        uint256 _rarity
    ) external view returns (string memory) {
        require(_typeId < nextAnimalTypeId, "Animal type does not exist");
        
        AnimalTypeData memory animalType = animalTypes[_typeId];
        
        // Construire l'URI avec les métadonnées
        return string(abi.encodePacked(
            "https://api.enju.com/metadata/",
            "animal/", uint256ToString(_tokenId),
            "?type=", uint256ToString(_typeId),
            "&name=", _name,
            "&level=", uint256ToString(_level),
            "&rarity=", uint256ToString(_rarity),
            "&model3d=", animalType.model3DHash,
            "&image=", animalType.imageHash
        ));
    }

    /**
     * @dev Convertit un uint256 en string
     */
    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}