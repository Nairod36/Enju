// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Address, AddressLib } from "../lib/cross-chain-swap/lib/solidity-utils/contracts/libraries/AddressLib.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import { Timelocks, TimelocksLib } from "../lib/cross-chain-swap/contracts/libraries/TimelocksLib.sol";

/**
 * @title InchDirectBridge - Direct 1inch Integration
 * @dev Uses 1inch EscrowFactory directly for ETH ↔ NEAR bridge
 * @notice Integrates with deployed 1inch contracts on mainnet fork
 */
contract InchDirectBridge is ReentrancyGuard {
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    
    // Official 1inch EscrowFactory on Ethereum mainnet
    IEscrowFactory public constant ESCROW_FACTORY = IEscrowFactory(0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A);
    
    // Events
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        string nearAccount,
        uint256 amount
    );
    
    event SwapCompleted(
        address indexed escrow,
        bytes32 secret
    );

    // Simple tracking for our swaps
    struct BridgeSwap {
        address escrow;
        address user;
        uint256 amount;
        bytes32 hashlock;
        string nearAccount;
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
     * @dev Create ETH to NEAR bridge using 1inch escrow
     * @param hashlock The hash of the secret for HTLC
     * @param nearAccount NEAR account to receive tokens
     */
    function createETHToNEARBridge(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable nonReentrant returns (bytes32 swapId) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(nearAccount).length > 0, "NEAR account required");
        
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
            nearAccount,
            block.timestamp
        ));
        
        swaps[swapId] = BridgeSwap({
            escrow: escrowAddress,
            user: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            nearAccount: nearAccount,
            completed: false,
            createdAt: block.timestamp
        });
        
        emit EscrowCreated(escrowAddress, hashlock, nearAccount, msg.value);
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
        
        // In a real implementation, this would trigger NEAR side completion
        // For now, we just mark as completed
        
        emit SwapCompleted(swap.escrow, secret);
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
     * @dev Get bridge swap details
     */
    function getSwap(bytes32 swapId) external view returns (
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
            swap.nearAccount,
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
    
    // Receive ETH
    receive() external payable {}
}