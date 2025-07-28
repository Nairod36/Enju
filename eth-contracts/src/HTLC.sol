// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HTLC Ethereum for Cross-Chain Swaps with 1inch Fusion+
 * @dev Hashed Timelock Contract pour swaps ETH ↔ NEAR
 */
contract HTLCEthereum is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event HTLCCreated(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        string nearAccount
    );

    event HTLCWithdrawn(bytes32 indexed contractId, bytes32 preimage);
    event HTLCRefunded(bytes32 indexed contractId);

    // Struct pour stocker les détails du contrat HTLC
    struct HTLCContract {
        address sender;
        address receiver;
        address token; // address(0) pour ETH natif
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bool withdrawn;
        bool refunded;
        string nearAccount; // Account NEAR de destination
    }

    // Mapping des contrats HTLC
    mapping(bytes32 => HTLCContract) public contracts;

    // Durée par défaut : 24 heures
    uint256 public constant DEFAULT_TIMELOCK = 24 hours;

    /**
     * @dev Crée un nouveau HTLC avec des tokens ERC20
     * @param _receiver Adresse Ethereum qui peut withdraw
     * @param _token Adresse du token ERC20
     * @param _amount Montant à locker
     * @param _hashlock Hash du secret (SHA256)
     * @param _timelock Timestamp d'expiration
     * @param _nearAccount Account NEAR de destination
     */
    function createHTLC(
        address _receiver,
        address _token,
        uint256 _amount,
        bytes32 _hashlock,
        uint256 _timelock,
        string memory _nearAccount
    ) external nonReentrant returns (bytes32 contractId) {
        require(_receiver != address(0), "Invalid receiver");
        require(_amount > 0, "Amount must be > 0");
        require(_timelock > block.timestamp, "Timelock in the past");
        require(_hashlock != bytes32(0), "Invalid hashlock");

        // Génère un ID unique pour le contrat
        contractId = keccak256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                _token,
                _amount,
                _hashlock,
                _timelock,
                block.timestamp
            )
        );

        require(contracts[contractId].sender == address(0), "Contract exists");

        // Transfère les tokens vers ce contrat
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // Stocke le contrat
        contracts[contractId] = HTLCContract(
            msg.sender,
            _receiver,
            _token,
            _amount,
            _hashlock,
            _timelock,
            false,
            false,
            _nearAccount
        );

        emit HTLCCreated(
            contractId, 
            msg.sender, 
            _receiver, 
            _token, 
            _amount, 
            _hashlock, 
            _timelock,
            _nearAccount
        );
    }

    /**
     * @dev Crée un nouveau HTLC avec ETH natif
     */
    function createHTLCEth(
        address _receiver,
        bytes32 _hashlock,
        uint256 _timelock,
        string memory _nearAccount
    ) external payable nonReentrant returns (bytes32 contractId) {
        require(_receiver != address(0), "Invalid receiver");
        require(msg.value > 0, "Amount must be > 0");
        require(_timelock > block.timestamp, "Timelock in the past");
        require(_hashlock != bytes32(0), "Invalid hashlock");

        contractId = keccak256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                address(0), // ETH natif
                msg.value,
                _hashlock,
                _timelock,
                block.timestamp
            )
        );

        require(contracts[contractId].sender == address(0), "Contract exists");

        contracts[contractId] = HTLCContract(
            msg.sender,
            _receiver,
            address(0), // ETH natif
            msg.value,
            _hashlock,
            _timelock,
            false,
            false,
            _nearAccount
        );

        emit HTLCCreated(
            contractId, 
            msg.sender, 
            _receiver, 
            address(0), 
            msg.value, 
            _hashlock, 
            _timelock,
            _nearAccount
        );
    }

    /**
     * @dev Withdraw les fonds avec le preimage (secret)
     * @param _contractId ID du contrat HTLC
     * @param _preimage Le secret qui hash vers hashlock
     */
    function withdraw(bytes32 _contractId, bytes32 _preimage) 
        external 
        nonReentrant 
    {
        HTLCContract storage htlc = contracts[_contractId];
        
        require(htlc.sender != address(0), "Contract does not exist");
        require(!htlc.withdrawn, "Already withdrawn");
        require(!htlc.refunded, "Already refunded");
        require(htlc.receiver == msg.sender, "Not the receiver");
        require(block.timestamp <= htlc.timelock, "Timelock expired");
        require(sha256(abi.encodePacked(_preimage)) == htlc.hashlock, "Invalid preimage");

        htlc.withdrawn = true;

        // Transfère les fonds
        if (htlc.token == address(0)) {
            // ETH natif
            payable(msg.sender).transfer(htlc.amount);
        } else {
            // Token ERC20
            IERC20(htlc.token).safeTransfer(msg.sender, htlc.amount);
        }

        emit HTLCWithdrawn(_contractId, _preimage);
    }

    /**
     * @dev Refund les fonds après expiration du timelock
     * @param _contractId ID du contrat HTLC
     */
    function refund(bytes32 _contractId) external nonReentrant {
        HTLCContract storage htlc = contracts[_contractId];
        
        require(htlc.sender != address(0), "Contract does not exist");
        require(!htlc.withdrawn, "Already withdrawn");
        require(!htlc.refunded, "Already refunded");
        require(htlc.sender == msg.sender, "Not the sender");
        require(block.timestamp > htlc.timelock, "Timelock not expired");

        htlc.refunded = true;

        // Refund les fonds au sender original
        if (htlc.token == address(0)) {
            // ETH natif
            payable(msg.sender).transfer(htlc.amount);
        } else {
            // Token ERC20
            IERC20(htlc.token).safeTransfer(msg.sender, htlc.amount);
        }

        emit HTLCRefunded(_contractId);
    }

    /**
     * @dev Vérifie si un contrat existe et ses détails
     */
    function getContract(bytes32 _contractId) 
        external 
        view 
        returns (HTLCContract memory) 
    {
        return contracts[_contractId];
    }

    /**
     * @dev Vérifie si un preimage est valide pour un contrat
     */
    function checkPreimage(bytes32 _contractId, bytes32 _preimage) 
        external 
        view 
        returns (bool) 
    {
        HTLCContract memory htlc = contracts[_contractId];
        return sha256(abi.encodePacked(_preimage)) == htlc.hashlock;
    }
}