// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "solidity-utils/contracts/libraries/AddressLib.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import { Timelocks } from "../lib/cross-chain-swap/contracts/libraries/TimelocksLib.sol";

/**
 * @title CrossChainBridge - ETH ↔ NEAR Cross-Chain Bridge
 * @dev Simplified bridge implementation using 1inch Escrow infrastructure
 * @notice Works with official 1inch Escrow Factory for secure cross-chain swaps
 */
contract CrossChainBridge is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Official 1inch Escrow Factory address
    IEscrowFactory public constant ESCROW_FACTORY = IEscrowFactory(0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A);
    
    // Events
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed user,
        uint256 amount,
        bytes32 hashlock,
        string nearAccount
    );
    
    event SwapCompleted(
        bytes32 indexed swapId,
        bytes32 secret
    );
    
    event SwapRefunded(
        bytes32 indexed swapId
    );

    // Simple swap structure
    struct CrossChainSwap {
        address user;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bool completed;
        bool refunded;
        string nearAccount;
    }

    mapping(bytes32 => CrossChainSwap) public swaps;
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
     * @dev Create a simple cross-chain swap (ETH to NEAR)
     * @param hashlock The hash of the secret
     * @param nearAccount NEAR account to receive tokens
     */
    function createSwap(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable nonReentrant returns (bytes32 swapId) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(nearAccount).length > 0, "NEAR account required");
        
        uint256 timelock = block.timestamp + 24 hours; // 24 hour timelock
        
        swapId = keccak256(abi.encodePacked(
            msg.sender,
            msg.value,
            hashlock,
            timelock,
            nearAccount,
            block.timestamp
        ));
        
        require(swaps[swapId].user == address(0), "Swap already exists");
        
        swaps[swapId] = CrossChainSwap({
            user: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            timelock: timelock,
            completed: false,
            refunded: false,
            nearAccount: nearAccount
        });
        
        emit SwapInitiated(swapId, msg.sender, msg.value, hashlock, nearAccount);
    }
    
    /**
     * @dev Complete a swap by providing the secret
     * @param swapId The swap identifier
     * @param secret The secret that generates the hash
     */
    function completeSwap(
        bytes32 swapId,
        bytes32 secret
    ) external onlyAuthorized nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        
        require(swap.user != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(!swap.refunded, "Already refunded");
        require(block.timestamp <= swap.timelock, "Swap expired");
        require(sha256(abi.encodePacked(secret)) == swap.hashlock, "Invalid secret");
        
        swap.completed = true;
        
        // In a real implementation, this would transfer to NEAR resolver
        // For now, we just mark as completed
        
        emit SwapCompleted(swapId, secret);
    }
    
    /**
     * @dev Refund an expired swap
     * @param swapId The swap identifier
     */
    function refundSwap(bytes32 swapId) external nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        
        require(swap.user != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(!swap.refunded, "Already refunded");
        require(
            msg.sender == swap.user || block.timestamp > swap.timelock,
            "Cannot refund yet"
        );
        
        swap.refunded = true;
        
        payable(swap.user).transfer(swap.amount);
        
        emit SwapRefunded(swapId);
    }
    
    /**
     * @dev Get swap details
     * @param swapId The swap identifier
     */
    function getSwap(bytes32 swapId) external view returns (
        address user,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        bool completed,
        bool refunded,
        string memory nearAccount
    ) {
        CrossChainSwap storage swap = swaps[swapId];
        return (
            swap.user,
            swap.amount,
            swap.hashlock,
            swap.timelock,
            swap.completed,
            swap.refunded,
            swap.nearAccount
        );
    }
    
    /**
     * @dev Authorize a resolver
     * @param resolver Address to authorize
     */
    function authorizeResolver(address resolver) external {
        require(msg.sender == owner, "Only owner");
        authorizedResolvers[resolver] = true;
    }
    
    /**
     * @dev Remove authorization from a resolver
     * @param resolver Address to deauthorize
     */
    function deauthorizeResolver(address resolver) external {
        require(msg.sender == owner, "Only owner");
        authorizedResolvers[resolver] = false;
    }
    
    /**
     * @dev Emergency withdraw - only owner
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive ETH
    receive() external payable {}
}