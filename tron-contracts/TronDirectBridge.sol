// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title TronDirectBridge - Direct Tron Integration for 1inch Fusion+
 * @dev Bridge contract for TRX/TRC20 ↔ ETH/NEAR swaps
 * @notice Extends the 1inch Fusion+ bridge to support Tron blockchain
 */
contract TronDirectBridge {
    
    // Events
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        string targetAccount, // ETH address only
        uint256 amount,
        string targetChain    // "ethereum" only
    );
    
    event SwapCompleted(
        address indexed escrow,
        bytes32 secret
    );
    
    event SwapRefunded(
        address indexed escrow,
        address indexed user
    );

    // Bridge swap structure for Tron
    struct TronBridgeSwap {
        address user;
        uint256 amount;
        bytes32 hashlock;
        string targetAccount;   // ETH address only
        string targetChain;     // "ethereum" only
        bool completed;
        bool refunded;
        uint256 createdAt;
        uint256 timelock;       // Expiration time
    }

    mapping(bytes32 => TronBridgeSwap) public swaps;
    mapping(address => bool) public authorizedResolvers;
    
    address public owner;
    uint256 public constant TIMELOCK_DURATION = 24 hours;
    
    modifier onlyAuthorized() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedResolvers[msg.sender] = true;
    }

    /**
     * @dev Create TRX to ETH bridge
     * @param hashlock The hash of the secret for HTLC
     * @param targetAccount ETH address to receive tokens
     * @param targetChain Target blockchain ("ethereum" only)
     */
    function createTronBridge(
        bytes32 hashlock,
        string calldata targetAccount,
        string calldata targetChain
    ) external payable returns (bytes32 swapId) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(targetAccount).length > 0, "Target account required");
        require(
            keccak256(bytes(targetChain)) == keccak256(bytes("ethereum")),
            "Only ethereum target chain supported"
        );
        
        swapId = keccak256(abi.encodePacked(
            msg.sender,
            hashlock,
            targetAccount,
            targetChain,
            block.timestamp
        ));
        
        require(swaps[swapId].user == address(0), "Swap already exists");
        
        swaps[swapId] = TronBridgeSwap({
            user: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            targetAccount: targetAccount,
            targetChain: targetChain,
            completed: false,
            refunded: false,
            createdAt: block.timestamp,
            timelock: block.timestamp + TIMELOCK_DURATION
        });
        
        emit EscrowCreated(address(this), hashlock, targetAccount, msg.value, targetChain);
        
        return swapId;
    }
    
    /**
     * @dev Complete bridge swap with secret
     * @param swapId The swap identifier
     * @param secret The secret that generates the hashlock
     */
    function completeSwap(
        bytes32 swapId,
        bytes32 secret
    ) external onlyAuthorized {
        TronBridgeSwap storage swap = swaps[swapId];
        
        require(swap.user != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(!swap.refunded, "Already refunded");
        require(block.timestamp < swap.timelock, "Swap expired");
        require(sha256(abi.encodePacked(secret)) == swap.hashlock, "Invalid secret");
        
        swap.completed = true;
        
        emit SwapCompleted(address(this), secret);
    }
    
    /**
     * @dev Refund swap after timelock expires
     * @param swapId The swap identifier
     */
    function refundSwap(bytes32 swapId) external {
        TronBridgeSwap storage swap = swaps[swapId];
        
        require(swap.user != address(0), "Swap not found");
        require(!swap.completed, "Already completed");
        require(!swap.refunded, "Already refunded");
        require(block.timestamp >= swap.timelock, "Timelock not expired");
        require(msg.sender == swap.user || authorizedResolvers[msg.sender], "Not authorized");
        
        swap.refunded = true;
        
        // Refund TRX to user
        payable(swap.user).transfer(swap.amount);
        
        emit SwapRefunded(address(this), swap.user);
    }
    
    /**
     * @dev Get bridge swap details
     */
    function getSwap(bytes32 swapId) external view returns (
        address user,
        uint256 amount,
        bytes32 hashlock,
        string memory targetAccount,
        string memory targetChain,
        bool completed,
        bool refunded,
        uint256 createdAt,
        uint256 timelock
    ) {
        TronBridgeSwap storage swap = swaps[swapId];
        return (
            swap.user,
            swap.amount,
            swap.hashlock,
            swap.targetAccount,
            swap.targetChain,
            swap.completed,
            swap.refunded,
            swap.createdAt,
            swap.timelock
        );
    }
    
    /**
     * @dev Authorize a resolver
     */
    function authorizeResolver(address resolver) external onlyOwner {
        authorizedResolvers[resolver] = true;
    }
    
    /**
     * @dev Revoke resolver authorization
     */
    function revokeResolver(address resolver) external onlyOwner {
        authorizedResolvers[resolver] = false;
    }
    
    /**
     * @dev Emergency functions - only for stuck funds
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Receive TRX
    receive() external payable {}
    fallback() external payable {}
}