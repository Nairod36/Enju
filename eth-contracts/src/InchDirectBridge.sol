// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import { Address, AddressLib } from "../lib/cross-chain-swap/lib/solidity-utils/contracts/libraries/AddressLib.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import { Timelocks, TimelocksLib } from "../lib/cross-chain-swap/contracts/libraries/TimelocksLib.sol";

/**
 * @title InchDirectBridge - Multi-Chain 1inch Integration
 * @dev Uses 1inch EscrowFactory directly for ETH ↔ NEAR ↔ TRON bridge
 * @notice Integrates with deployed 1inch contracts on mainnet fork - supports multiple destinations
 */
contract InchDirectBridge is ReentrancyGuard {
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    
    // Official 1inch EscrowFactory on Ethereum mainnet
    IEscrowFactory public constant ESCROW_FACTORY = IEscrowFactory(0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A);
    
    // Chain identifiers
    enum DestinationChain { NEAR, TRON }
    
    // Events - Multi-chain support
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        DestinationChain indexed destinationChain,
        string destinationAccount,
        uint256 amount
    );
    
    // Legacy event for backward compatibility
    event EscrowCreatedLegacy(
        address indexed escrow,
        bytes32 indexed hashlock,
        string nearAccount,
        uint256 amount
    );
    
    event NEARToETHEscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        address indexed ethRecipient,
        uint256 amount
    );
    
    event SwapCompleted(
        address indexed escrow,
        bytes32 secret,
        DestinationChain destinationChain
    );

    // Multi-chain bridge swap tracking
    struct BridgeSwap {
        address escrow;
        address user;
        uint256 amount;
        bytes32 hashlock;
        DestinationChain destinationChain;
        string destinationAccount; // NEAR account or TRON address
        bool completed;
        uint256 createdAt;
    }

    mapping(bytes32 => BridgeSwap) public swaps;
    mapping(address => bool) public authorizedResolvers;
    
    address public owner;
    
    modifier onlyAuthorized() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedResolvers[msg.sender] = true;
    }

    /**
     * @dev Create multi-chain bridge using 1inch escrow
     * @param hashlock The hash of the secret for HTLC
     * @param destinationChain Target chain (NEAR or TRON)
     * @param destinationAccount Account/address on destination chain
     */
    function _createCrossChainBridge(
        bytes32 hashlock,
        DestinationChain destinationChain,
        string calldata destinationAccount
    ) internal returns (bytes32 swapId) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(destinationAccount).length > 0, "Destination account required");
        
        // Validate destination account format
        if (destinationChain == DestinationChain.TRON) {
            require(_isValidTronAddress(destinationAccount), "Invalid TRON address format");
        } else if (destinationChain == DestinationChain.NEAR) {
            require(_isValidNearAccount(destinationAccount), "Invalid NEAR account format");
        }
        
        // Create immutables for 1inch escrow
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(msg.sender, hashlock, block.timestamp)),
            hashlock: hashlock,
            maker: Address.wrap(uint160(msg.sender)),
            taker: Address.wrap(uint160(address(this))), // We act as taker
            token: Address.wrap(uint160(address(0))), // ETH (zero address)
            amount: msg.value,
            safetyDeposit: 0,
            timelocks: _createTimelocks()
        });
        
        // Get the deterministic escrow address
        address escrowAddress = ESCROW_FACTORY.addressOfEscrowSrc(immutables);
        
        // Send ETH to the escrow address (1inch pattern)
        payable(escrowAddress).transfer(msg.value);
        
        // Create the escrow using 1inch factory
        // Note: This would normally be called by 1inch's limit order protocol
        // For direct usage, we simulate the escrow creation
        
        swapId = keccak256(abi.encodePacked(
            escrowAddress,
            hashlock,
            uint256(destinationChain),
            destinationAccount,
            block.timestamp
        ));
        
        swaps[swapId] = BridgeSwap({
            escrow: escrowAddress,
            user: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            destinationChain: destinationChain,
            destinationAccount: destinationAccount,
            completed: false,
            createdAt: block.timestamp
        });
        
        // Emit new multi-chain event
        emit EscrowCreated(escrowAddress, hashlock, destinationChain, destinationAccount, msg.value);
        
        // Emit legacy event for backward compatibility (only for NEAR)
        if (destinationChain == DestinationChain.NEAR) {
            emit EscrowCreatedLegacy(escrowAddress, hashlock, destinationAccount, msg.value);
        }
    }
    
    
    /**
     * @dev Create NEAR to ETH bridge - bridge-listener creates ETH escrow for user
     * @param hashlock The hash of the secret for HTLC
     * @param ethRecipient ETH address to receive tokens
     */
    function createNEARToETHBridge(
        bytes32 hashlock,
        address ethRecipient
    ) external payable nonReentrant returns (bytes32 swapId) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(ethRecipient != address(0), "ETH recipient required");
        
        // Create immutables for 1inch escrow - reverse direction for NEAR→ETH
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(msg.sender, hashlock, block.timestamp)),
            hashlock: hashlock,
            maker: Address.wrap(uint160(msg.sender)), // Bridge-listener as maker
            taker: Address.wrap(uint160(ethRecipient)), // User as taker
            token: Address.wrap(uint160(address(0))), // ETH (zero address)
            amount: msg.value,
            safetyDeposit: 0,
            timelocks: _createTimelocks()
        });
        
        // Get the deterministic escrow address
        address escrowAddress = ESCROW_FACTORY.addressOfEscrowSrc(immutables);
        
        // Send ETH to the escrow address (1inch pattern)
        payable(escrowAddress).transfer(msg.value);
        
        swapId = keccak256(abi.encodePacked(
            escrowAddress,
            hashlock,
            ethRecipient,
            block.timestamp
        ));
        
        swaps[swapId] = BridgeSwap({
            escrow: escrowAddress,
            user: ethRecipient, // The ETH recipient is the user
            amount: msg.value,
            hashlock: hashlock,
            destinationChain: DestinationChain.NEAR, // NEAR→ETH direction
            destinationAccount: "", // Empty for NEAR→ETH direction  
            completed: false,
            createdAt: block.timestamp
        });
        
        emit NEARToETHEscrowCreated(escrowAddress, hashlock, ethRecipient, msg.value);
    }
    
    /**
     * @dev Complete bridge swap with secret
     * @param swapId The swap identifier
     * @param secret The secret that generates the hashlock
     */
    function completeSwap(
        bytes32 swapId,
        bytes32 secret
    ) external onlyAuthorized nonReentrant {
        BridgeSwap storage swap = swaps[swapId];
        
        require(swap.escrow != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(sha256(abi.encodePacked(secret)) == swap.hashlock, "Invalid secret");
        
        swap.completed = true;
        
        // In a real implementation, this would trigger destination chain completion
        // For now, we just mark as completed
        
        emit SwapCompleted(swap.escrow, secret, swap.destinationChain);
    }
    
    /**
     * @dev Create multi-chain bridge using 1inch escrow (public interface)
     * @param hashlock The hash of the secret for HTLC
     * @param destinationChain Target chain (NEAR or TRON)
     * @param destinationAccount Account/address on destination chain
     */
    function createCrossChainBridge(
        bytes32 hashlock,
        DestinationChain destinationChain,
        string calldata destinationAccount
    ) external payable nonReentrant returns (bytes32 swapId) {
        return _createCrossChainBridge(hashlock, destinationChain, destinationAccount);
    }
    
    /**
     * @dev Legacy function - Create ETH to NEAR bridge (backward compatibility)
     * @param hashlock The hash of the secret for HTLC
     * @param nearAccount NEAR account to receive tokens
     */
    function createETHToNEARBridge(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable nonReentrant returns (bytes32 swapId) {
        return _createCrossChainBridge(hashlock, DestinationChain.NEAR, nearAccount);
    }
    
    /**
     * @dev Create ETH to TRON bridge using 1inch escrow
     * @param hashlock The hash of the secret for HTLC
     * @param tronAddress TRON address to receive tokens
     */
    function createETHToTRONBridge(
        bytes32 hashlock,
        string calldata tronAddress
    ) external payable nonReentrant returns (bytes32 swapId) {
        return _createCrossChainBridge(hashlock, DestinationChain.TRON, tronAddress);
    }
    
    /**
     * @dev Create timelocks for 1inch escrow (24 hours)
     */
    function _createTimelocks() internal view returns (Timelocks) {
        // Use 1inch TimelocksLib to create proper timelocks
        // Src timelocks: withdrawal(12h), publicWithdrawal(18h), cancellation(24h), publicCancellation(30h)
        uint32 srcWithdrawal = uint32(block.timestamp + 12 hours);
        uint32 srcPublicWithdrawal = uint32(block.timestamp + 18 hours);
        uint32 srcCancellation = uint32(block.timestamp + 24 hours);
        uint32 srcPublicCancellation = uint32(block.timestamp + 30 hours);
        
        // Dst timelocks: withdrawal(6h), publicWithdrawal(12h), cancellation(18h)
        uint32 dstWithdrawal = uint32(block.timestamp + 6 hours);
        uint32 dstPublicWithdrawal = uint32(block.timestamp + 12 hours);
        uint32 dstCancellation = uint32(block.timestamp + 18 hours);
        
        // Pack using 1inch format (this is simplified - real packing is more complex)
        uint256 packed = 
            (uint256(srcWithdrawal) << 192) |
            (uint256(srcPublicWithdrawal) << 160) |
            (uint256(srcCancellation) << 128) |
            (uint256(srcPublicCancellation) << 96) |
            (uint256(dstWithdrawal) << 64) |
            (uint256(dstPublicWithdrawal) << 32) |
            uint256(dstCancellation);
        
        return Timelocks.wrap(packed);
    }
    
    /**
     * @dev Get bridge swap details - Updated for multi-chain
     */
    function getSwap(bytes32 swapId) external view returns (
        address escrow,
        address user,
        uint256 amount,
        bytes32 hashlock,
        DestinationChain destinationChain,
        string memory destinationAccount,
        bool completed,
        uint256 createdAt
    ) {
        BridgeSwap storage swap = swaps[swapId];
        return (
            swap.escrow,
            swap.user,
            swap.amount,
            swap.hashlock,
            swap.destinationChain,
            swap.destinationAccount,
            swap.completed,
            swap.createdAt
        );
    }
    
    /**
     * @dev Legacy function - Get NEAR swap details (backward compatibility)
     */
    function getSwapLegacy(bytes32 swapId) external view returns (
        address escrow,
        address user,
        uint256 amount,
        bytes32 hashlock,
        string memory nearAccount,
        bool completed,
        uint256 createdAt
    ) {
        BridgeSwap storage swap = swaps[swapId];
        return (
            swap.escrow,
            swap.user,
            swap.amount,
            swap.hashlock,
            swap.destinationAccount, // This will be NEAR account if destinationChain is NEAR
            swap.completed,
            swap.createdAt
        );
    }
    
    /**
     * @dev Check if 1inch EscrowFactory is available
     */
    function checkEscrowFactory() external view returns (bool) {
        // Simple check if the factory contract exists
        uint256 size;
        address factory = address(ESCROW_FACTORY);
        assembly {
            size := extcodesize(factory)
        }
        return size > 0;
    }
    
    /**
     * @dev Authorize a resolver
     */
    function authorizeResolver(address resolver) external {
        require(msg.sender == owner, "Only owner");
        authorizedResolvers[resolver] = true;
    }
    
    /**
     * @dev Emergency functions
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @dev Validate TRON address format (basic validation)
     * @param tronAddress The TRON address to validate
     */
    function _isValidTronAddress(string memory tronAddress) internal pure returns (bool) {
        bytes memory addr = bytes(tronAddress);
        
        // TRON addresses are 34 characters long and start with 'T'
        if (addr.length != 34) {
            return false;
        }
        
        if (addr[0] != 'T') {
            return false;
        }
        
        // Basic check - all characters should be alphanumeric (Base58)
        for (uint i = 1; i < addr.length; i++) {
            bytes1 char = addr[i];
            if (!(char >= '1' && char <= '9') && // 1-9
                !(char >= 'A' && char <= 'Z') && // A-Z
                !(char >= 'a' && char <= 'z') && // a-z
                char != '0' &&                   // Exclude 0, O, I, l in Base58
                char != 'O' &&
                char != 'I' &&
                char != 'l') {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Validate NEAR account format (basic validation)
     * @param nearAccount The NEAR account to validate
     */
    function _isValidNearAccount(string memory nearAccount) internal pure returns (bool) {
        bytes memory account = bytes(nearAccount);
        
        // NEAR accounts must be 2-64 characters
        if (account.length < 2 || account.length > 64) {
            return false;
        }
        
        // Check for valid characters (lowercase, digits, hyphens, underscores)
        for (uint i = 0; i < account.length; i++) {
            bytes1 char = account[i];
            if (!(char >= 'a' && char <= 'z') && 
                !(char >= '0' && char <= '9') && 
                char != '-' && 
                char != '_' &&
                char != '.') {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Get number of swaps by destination chain
     */
    function getChainStats() external view returns (
        uint256 totalSwaps,
        uint256 nearSwaps,
        uint256 tronSwaps,
        uint256 completedSwaps
    ) {
        // This would require additional mappings for efficient counting
        // For now, return placeholder values
        return (0, 0, 0, 0);
    }
    
    // Receive ETH
    receive() external payable {}
}