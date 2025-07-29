// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowSrc.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowDst.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";

/**
 * @title InchCrossChainResolver - ETH ↔ NEAR Cross-Chain Resolver
 * @dev Resolver implementation for 1inch Fusion+ cross-chain swaps
 * @notice Integrates with official 1inch Escrow Factory (0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a)
 */
contract InchCrossChainResolver is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Official 1inch Escrow Factory address
    IEscrowFactory public constant ESCROW_FACTORY = IEscrowFactory(0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a);
    
    // Events
    event CrossChainSwapInitiated(
        address indexed escrowSrc,
        bytes32 indexed secretHash,
        string nearAccount,
        uint256 amount
    );
    
    event CrossChainSwapCompleted(
        address indexed escrowSrc,
        bytes32 preimage
    );
    
    event NEARSwapCreated(
        string indexed nearTxHash,
        bytes32 indexed secretHash,
        address ethRecipient
    );

    // Structure to track cross-chain swaps
    struct CrossChainSwap {
        address escrowSrc;
        bytes32 secretHash;
        string nearAccount;
        uint256 amount;
        address token;
        bool completed;
        uint256 expirationTime;
    }

    mapping(bytes32 => CrossChainSwap) public swaps;
    mapping(address => bool) public authorizedResolvers;
    
    modifier onlyAuthorized() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    address public owner;
    
    constructor() {
        owner = msg.sender;
        authorizedResolvers[msg.sender] = true;
    }

    /**
     * @dev Creates a cross-chain swap from ETH to NEAR using 1inch Escrow
     * @param immutables The escrow immutables struct from 1inch
     * @param nearAccount NEAR account to receive tokens
     */
    function createETHToNEARSwap(
        IBaseEscrow.Immutables calldata immutables,
        string calldata nearAccount
    ) external payable nonReentrant returns (bytes32 swapId) {
        require(bytes(nearAccount).length > 0, "Invalid NEAR account");
        
        // Create escrow using 1inch factory
        address escrowSrc = ESCROW_FACTORY.createSrc(immutables);
        
        swapId = keccak256(abi.encodePacked(
            escrowSrc,
            immutables.hashlock,
            nearAccount,
            block.timestamp
        ));
        
        swaps[swapId] = CrossChainSwap({
            escrowSrc: escrowSrc,
            secretHash: immutables.hashlock,
            nearAccount: nearAccount,
            amount: immutables.amount,
            token: immutables.token.get(),
            completed: false,
            expirationTime: block.timestamp + 24 hours
        });
        
        emit CrossChainSwapInitiated(
            escrowSrc,
            immutables.hashlock,
            nearAccount,
            immutables.amount
        );
    }
    
    /**
     * @dev Completes a cross-chain swap by providing the secret
     * @param swapId The swap identifier
     * @param secret The secret that generates the hash
     * @param immutables The escrow immutables for verification
     */
    function completeSwap(
        bytes32 swapId,
        bytes32 secret,
        IBaseEscrow.Immutables calldata immutables
    ) external nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.escrowSrc != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(block.timestamp <= swap.expirationTime, "Swap expired");
        require(sha256(abi.encodePacked(secret)) == swap.secretHash, "Invalid secret");
        
        swap.completed = true;
        
        // Withdraw from 1inch escrow
        IEscrowSrc(swap.escrowSrc).withdraw(secret, immutables);
        
        emit CrossChainSwapCompleted(swap.escrowSrc, secret);
    }
    
    /**
     * @dev Register a NEAR swap that was created on NEAR side
     * @param nearTxHash NEAR transaction hash
     * @param secretHash The hash of the secret
     * @param ethRecipient Ethereum address to receive tokens
     */
    function registerNEARSwap(
        string calldata nearTxHash,
        bytes32 secretHash,
        address ethRecipient
    ) external onlyAuthorized {
        require(ethRecipient != address(0), "Invalid recipient");
        
        emit NEARSwapCreated(nearTxHash, secretHash, ethRecipient);
    }
    
    /**
     * @dev Cancel an expired swap
     * @param swapId The swap identifier
     * @param immutables The escrow immutables
     */
    function cancelSwap(
        bytes32 swapId,
        IBaseEscrow.Immutables calldata immutables
    ) external nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.escrowSrc != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(block.timestamp > swap.expirationTime, "Not expired");
        
        // Cancel the escrow
        IEscrowSrc(swap.escrowSrc).cancel(immutables);
        
        delete swaps[swapId];
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
     * @dev Get swap details
     * @param swapId The swap identifier
     */
    function getSwap(bytes32 swapId) external view returns (CrossChainSwap memory) {
        return swaps[swapId];
    }
    
    /**
     * @dev Emergency function - only owner
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive ETH
    receive() external payable {}
}