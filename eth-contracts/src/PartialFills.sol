// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PartialFills - Handles partial fill functionality
 * @dev Separate contract for partial fills to reduce main contract size
 */
contract PartialFills {
    
    // Partial fill events
    event PartialFillCreated(
        bytes32 indexed swapId,
        bytes32 indexed fillId,
        address indexed escrow,
        uint256 fillAmount,
        uint256 remainingAmount
    );
    
    event PartialFillCompleted(
        bytes32 indexed fillId,
        bytes32 secret,
        address indexed recipient,
        uint256 amount
    );
    
    // Partial fill tracking
    struct PartialFill {
        bytes32 swapId;
        address escrow;
        uint256 amount;
        uint256 timestamp;
        bytes32 fillId;
    }
    
    mapping(bytes32 => PartialFill[]) public swapFills;
    mapping(bytes32 => bool) public completedFills;
    
    /**
     * @dev Create a partial fill
     */
    function createPartialFill(
        bytes32 swapId,
        address escrow,
        uint256 amount
    ) external returns (bytes32 fillId) {
        fillId = keccak256(abi.encodePacked(swapId, escrow, amount, block.timestamp));
        
        swapFills[swapId].push(PartialFill({
            swapId: swapId,
            escrow: escrow,
            amount: amount,
            timestamp: block.timestamp,
            fillId: fillId
        }));
        
        emit PartialFillCreated(swapId, fillId, escrow, amount, 0);
    }
    
    /**
     * @dev Complete a partial fill
     */
    function completePartialFill(
        bytes32 fillId,
        bytes32 secret,
        address recipient,
        uint256 amount
    ) external {
        require(!completedFills[fillId], "Fill already completed");
        
        completedFills[fillId] = true;
        emit PartialFillCompleted(fillId, secret, recipient, amount);
    }
    
    /**
     * @dev Get fills for a swap
     */
    function getSwapFills(bytes32 swapId) external view returns (PartialFill[] memory) {
        return swapFills[swapId];
    }
}
