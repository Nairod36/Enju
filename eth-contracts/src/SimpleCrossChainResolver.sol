// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleCrossChainResolver - Simplified Bridge for Testing
 * @dev Temporary simple version without 1inch integration for debugging
 */
contract SimpleCrossChainResolver is Ownable {
    
    // Chain identifiers for cross-chain operations
    enum DestinationChain { NEAR, TRON }
    
    // Events
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        uint8 indexed destinationChain,
        string destinationAccount,
        uint256 amount
    );
    
    event EscrowCreatedLegacy(
        address indexed escrow,
        bytes32 indexed hashlock,
        string nearAccount,
        uint256 amount
    );
    
    // Simple swap tracking
    struct CrossChainSwap {
        address srcEscrow;
        address user;
        uint256 amount;
        bytes32 hashlock;
        DestinationChain destinationChain;
        string destinationAccount;
        bool completed;
        uint256 createdAt;
    }
    
    mapping(bytes32 => CrossChainSwap) public swaps;
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Create ETH to NEAR bridge (simplified version)
     * @param hashlock The hash of the secret for HTLC
     * @param nearAccount NEAR account to receive tokens
     */
    function createETHToNEARBridge(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable returns (address escrow) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(nearAccount).length > 0, "NEAR account required");
        require(_isValidNearAccount(nearAccount), "Invalid NEAR account format");
        
        // Use contract address as escrow (simplified)
        escrow = address(this);
        
        // Create swap tracking
        bytes32 swapId = keccak256(abi.encodePacked(
            escrow,
            hashlock,
            uint256(DestinationChain.NEAR),
            nearAccount,
            block.timestamp
        ));
        
        swaps[swapId] = CrossChainSwap({
            srcEscrow: escrow,
            user: msg.sender,
            amount: msg.value,
            hashlock: hashlock,
            destinationChain: DestinationChain.NEAR,
            destinationAccount: nearAccount,
            completed: false,
            createdAt: block.timestamp
        });
        
        // Emit events for compatibility
        emit EscrowCreated(escrow, hashlock, uint8(DestinationChain.NEAR), nearAccount, msg.value);
        emit EscrowCreatedLegacy(escrow, hashlock, nearAccount, msg.value);
    }
    
    /**
     * @dev Validate NEAR account format
     */
    function _isValidNearAccount(string memory nearAccount) internal pure returns (bool) {
        bytes memory account = bytes(nearAccount);
        
        if (account.length < 2 || account.length > 64) {
            return false;
        }
        
        for (uint i = 0; i < account.length; i++) {
            bytes1 char = account[i];
            if (!(char >= 'a' && char <= 'z') && 
                !(char >= '0' && char <= '9') && 
                char != '-' && char != '_' && char != '.') {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
