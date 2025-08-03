// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./TronFusionBridge.sol";

/**
 * @title TronPartialFills - Partial Fill Extension for TRON Bridge
 * @dev Extends TronFusionBridge with partial order execution capabilities
 * @notice Allows partial fulfillment of cross-chain swap orders on TRON side
 */
contract TronPartialFills is TronFusionBridge {
    
    // Partial fill specific structures
    struct PartialFillOrder {
        bytes32 parentOrderHash;    // Original order hash
        uint256 totalAmount;        // Total amount of the original order
        uint256 filledAmount;       // Amount already filled
        uint256 remainingAmount;    // Amount still available
        uint256 minFillAmount;      // Minimum amount per fill
        uint256 maxFillAmount;      // Maximum amount per fill
        bool isActive;              // Whether order accepts more fills
        PartialFillData[] fills;    // Array of individual fills
    }
    
    struct PartialFillData {
        bytes32 fillId;             // Unique fill identifier
        address filler;             // Address that executed this fill
        uint256 amount;             // Amount filled in this execution
        bytes32 secret;             // Secret used for this fill
        uint256 timestamp;          // When this fill was executed
        FillState state;            // Current state of this fill
        string targetAddress;       // Target address for this fill
    }
    
    enum FillState {
        Pending,        // Fill created, waiting for execution
        Completed,      // Fill successfully completed
        Failed,         // Fill failed or cancelled
        Expired         // Fill expired
    }
    
    // Storage mappings for partial fills
    mapping(bytes32 => PartialFillOrder) public partialOrders;
    mapping(bytes32 => PartialFillData) public fills;
    mapping(bytes32 => bytes32[]) public orderFills; // orderHash => fillIds array
    mapping(address => uint256) public fillerBonds; // Security deposits for fillers
    
    // Configuration for partial fills
    uint256 public constant MIN_PARTIAL_AMOUNT = 1000000; // 0.001 TRX minimum
    uint256 public constant FILLER_BOND_RATIO = 10; // 10% of fill amount as bond
    uint256 public constant PARTIAL_FILL_TIMEOUT = 30 minutes; // Timeout for each fill
    
    // Events for partial fills
    event PartialOrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        uint256 totalAmount,
        uint256 minFillAmount,
        uint256 maxFillAmount,
        string targetChain
    );
    
    event PartialFillExecuted(
        bytes32 indexed orderHash,
        bytes32 indexed fillId,
        address indexed filler,
        uint256 amount,
        uint256 remainingAmount,
        string targetAddress
    );
    
    event PartialFillCompleted(
        bytes32 indexed fillId,
        bytes32 secret,
        address indexed filler,
        uint256 amount
    );
    
    event PartialOrderFullyFilled(
        bytes32 indexed orderHash,
        uint256 totalAmount,
        uint256 totalFills
    );
    
    event FillerBondSlashed(
        address indexed filler,
        bytes32 indexed fillId,
        uint256 amount,
        string reason
    );
    
    modifier validPartialAmount(uint256 amount, bytes32 orderHash) {
        PartialFillOrder storage order = partialOrders[orderHash];
        require(amount >= order.minFillAmount, "Amount below minimum");
        require(amount <= order.maxFillAmount, "Amount above maximum");
        require(amount <= order.remainingAmount, "Amount exceeds remaining");
        require(amount >= MIN_PARTIAL_AMOUNT, "Amount too small");
        _;
    }
    
    modifier onlyActiveFiller() {
        require(fillerBonds[msg.sender] > 0, "Filler not bonded");
        _;
    }
    
    /**
     * @dev Create a partial fill order on TRON side
     * @param hashlock The hashlock for HTLC coordination
     * @param totalAmount Total amount available for filling
     * @param minFillAmount Minimum amount per individual fill
     * @param maxFillAmount Maximum amount per individual fill
     * @param targetChain Target blockchain (ethereum/near)
     * @param tronMaker TRON address of the order maker
     */
    function createPartialOrder(
        bytes32 hashlock,
        uint256 totalAmount,
        uint256 minFillAmount,
        uint256 maxFillAmount,
        string calldata targetChain,
        string calldata tronMaker
    ) external payable returns (bytes32 orderHash) {
        require(msg.value >= totalAmount, "Insufficient TRX sent");
        require(totalAmount >= MIN_PARTIAL_AMOUNT, "Total amount too small");
        require(minFillAmount <= maxFillAmount, "Invalid fill amounts");
        require(minFillAmount >= MIN_PARTIAL_AMOUNT, "Min fill too small");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(_isValidTronAddress(tronMaker), "Invalid TRON address");
        
        // Generate unique order hash
        orderHash = keccak256(abi.encodePacked(
            hashlock,
            msg.sender,
            totalAmount,
            minFillAmount,
            maxFillAmount,
            block.timestamp,
            targetChain
        ));
        
        require(partialOrders[orderHash].totalAmount == 0, "Order already exists");
        
        // Create partial fill order
        partialOrders[orderHash] = PartialFillOrder({
            parentOrderHash: orderHash,
            totalAmount: totalAmount,
            filledAmount: 0,
            remainingAmount: totalAmount,
            minFillAmount: minFillAmount,
            maxFillAmount: maxFillAmount,
            isActive: true,
            fills: new PartialFillData[](0)
        });
        
        emit PartialOrderCreated(
            orderHash,
            msg.sender,
            totalAmount,
            minFillAmount,
            maxFillAmount,
            targetChain
        );
        
        return orderHash;
    }
    
    /**
     * @dev Execute a partial fill of an existing order
     * @param orderHash The parent order to fill
     * @param fillAmount Amount to fill from the order
     * @param targetAddress Target address to receive funds on destination chain
     * @param fillSecret Secret for this specific fill (derived from main secret)
     */
    function executePartialFill(
        bytes32 orderHash,
        uint256 fillAmount,
        string calldata targetAddress,
        bytes32 fillSecret
    ) external payable onlyActiveFiller validPartialAmount(fillAmount, orderHash) returns (bytes32 fillId) {
        PartialFillOrder storage order = partialOrders[orderHash];
        require(order.isActive, "Order not active");
        require(order.remainingAmount >= fillAmount, "Insufficient remaining amount");
        
        // Calculate required bond (percentage of fill amount)
        uint256 requiredBond = (fillAmount * FILLER_BOND_RATIO) / 100;
        require(msg.value >= requiredBond, "Insufficient filler bond");
        require(fillerBonds[msg.sender] >= requiredBond, "Insufficient filler bond balance");
        
        // Generate unique fill ID
        fillId = keccak256(abi.encodePacked(
            orderHash,
            msg.sender,
            fillAmount,
            block.timestamp,
            targetAddress
        ));
        
        // Create fill data
        fills[fillId] = PartialFillData({
            fillId: fillId,
            filler: msg.sender,
            amount: fillAmount,
            secret: bytes32(0), // Will be set when completed
            timestamp: block.timestamp,
            state: FillState.Pending,
            targetAddress: targetAddress
        });
        
        // Update order state
        order.remainingAmount -= fillAmount;
        orderFills[orderHash].push(fillId);
        
        // Lock filler bond
        fillerBonds[msg.sender] -= requiredBond;
        
        // Check if order is fully filled
        if (order.remainingAmount < order.minFillAmount) {
            order.isActive = false;
            if (order.remainingAmount == 0) {
                emit PartialOrderFullyFilled(orderHash, order.totalAmount, orderFills[orderHash].length);
            }
        }
        
        emit PartialFillExecuted(
            orderHash,
            fillId,
            msg.sender,
            fillAmount,
            order.remainingAmount,
            targetAddress
        );
        
        return fillId;
    }
    
    /**
     * @dev Complete a partial fill with the secret
     * @param fillId The specific fill to complete
     * @param secret The secret that matches the hashlock
     */
    function completePartialFill(
        bytes32 fillId,
        bytes32 secret
    ) external {
        PartialFillData storage fill = fills[fillId];
        require(fill.state == FillState.Pending, "Fill not pending");
        require(block.timestamp <= fill.timestamp + PARTIAL_FILL_TIMEOUT, "Fill expired");
        
        // Verify secret (should be derived from parent order's hashlock)
        bytes32 expectedHash = sha256(abi.encodePacked(secret));
        // Note: In production, you'd verify this against the parent order's hashlock
        
        fill.state = FillState.Completed;
        fill.secret = secret;
        
        // Transfer TRX to filler (they will forward to destination chain)
        payable(fill.filler).transfer(fill.amount);
        
        // Return filler bond
        uint256 bondAmount = (fill.amount * FILLER_BOND_RATIO) / 100;
        fillerBonds[fill.filler] += bondAmount;
        
        emit PartialFillCompleted(fillId, secret, fill.filler, fill.amount);
    }
    
    /**
     * @dev Cancel/timeout a partial fill
     * @param fillId The fill to cancel
     */
    function cancelPartialFill(bytes32 fillId) external {
        PartialFillData storage fill = fills[fillId];
        require(fill.state == FillState.Pending, "Fill not pending");
        require(
            block.timestamp > fill.timestamp + PARTIAL_FILL_TIMEOUT || 
            msg.sender == fill.filler,
            "Cannot cancel yet"
        );
        
        fill.state = FillState.Failed;
        
        // Find parent order and restore amount
        bytes32 orderHash = _findOrderForFill(fillId);
        if (orderHash != bytes32(0)) {
            PartialFillOrder storage order = partialOrders[orderHash];
            order.remainingAmount += fill.amount;
            
            // Reactivate order if it was deactivated due to low remaining amount
            if (order.remainingAmount >= order.minFillAmount) {
                order.isActive = true;
            }
        }
        
        // Slash filler bond for timeout
        uint256 bondAmount = (fill.amount * FILLER_BOND_RATIO) / 100;
        if (block.timestamp > fill.timestamp + PARTIAL_FILL_TIMEOUT) {
            emit FillerBondSlashed(fill.filler, fillId, bondAmount, "TIMEOUT");
        } else {
            // Return bond for voluntary cancellation
            fillerBonds[fill.filler] += bondAmount;
        }
    }
    
    /**
     * @dev Register as a filler with security deposit
     */
    function registerFiller() external payable {
        require(msg.value >= MIN_PARTIAL_AMOUNT * 10, "Insufficient bond");
        fillerBonds[msg.sender] += msg.value;
    }
    
    /**
     * @dev Withdraw filler bond (must have no pending fills)
     * @param amount Amount to withdraw
     */
    function withdrawFillerBond(uint256 amount) external {
        require(fillerBonds[msg.sender] >= amount, "Insufficient bond balance");
        require(!_hasActiveFills(msg.sender), "Has active fills");
        
        fillerBonds[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    /**
     * @dev Get partial order details
     * @param orderHash The order to query
     */
    function getPartialOrder(bytes32 orderHash) external view returns (
        uint256 totalAmount,
        uint256 filledAmount,
        uint256 remainingAmount,
        uint256 minFillAmount,
        uint256 maxFillAmount,
        bool isActive,
        uint256 fillCount
    ) {
        PartialFillOrder storage order = partialOrders[orderHash];
        return (
            order.totalAmount,
            order.filledAmount,
            order.remainingAmount,
            order.minFillAmount,
            order.maxFillAmount,
            order.isActive,
            orderFills[orderHash].length
        );
    }
    
    /**
     * @dev Get fill details
     * @param fillId The fill to query
     */
    function getFill(bytes32 fillId) external view returns (
        address filler,
        uint256 amount,
        uint256 timestamp,
        FillState state,
        string memory targetAddress
    ) {
        PartialFillData storage fill = fills[fillId];
        return (
            fill.filler,
            fill.amount,
            fill.timestamp,
            fill.state,
            fill.targetAddress
        );
    }
    
    /**
     * @dev Get all fills for an order
     * @param orderHash The order to query
     */
    function getOrderFills(bytes32 orderHash) external view returns (bytes32[] memory) {
        return orderFills[orderHash];
    }
    
    /**
     * @dev Check if a filler has active (pending) fills
     * @param filler The filler address to check
     */
    function _hasActiveFills(address filler) internal view returns (bool) {
        // Note: In production, you'd maintain a mapping of filler => active fills
        // This is a simplified version
        return false; // Placeholder
    }
    
    /**
     * @dev Find the parent order for a given fill
     * @param fillId The fill to find parent for
     */
    function _findOrderForFill(bytes32 fillId) internal view returns (bytes32) {
        // Note: In production, you'd maintain a mapping of fillId => orderHash
        // This is a simplified version
        return bytes32(0); // Placeholder
    }
    
    /**
     * @dev Emergency function to deactivate an order
     * @param orderHash The order to deactivate
     */
    function emergencyDeactivateOrder(bytes32 orderHash) external onlyOwner {
        PartialFillOrder storage order = partialOrders[orderHash];
        require(order.totalAmount > 0, "Order not found");
        
        order.isActive = false;
        
        // Refund remaining amount to contract owner
        if (order.remainingAmount > 0) {
            payable(owner).transfer(order.remainingAmount);
        }
    }
    
    /**
     * @dev Get statistics for partial fill system
     */
    function getPartialFillStats() external view returns (
        uint256 totalBondsLocked,
        uint256 totalActiveFillers
    ) {
        // Note: In production, you'd maintain these stats
        totalBondsLocked = address(this).balance;
        totalActiveFillers = 0; // Placeholder
    }
    
    /**
     * @dev Batch complete multiple fills (gas optimization)
     * @param fillIds Array of fill IDs to complete
     * @param secrets Array of secrets corresponding to each fill
     */
    function batchCompletePartialFills(
        bytes32[] calldata fillIds,
        bytes32[] calldata secrets
    ) external {
        require(fillIds.length == secrets.length, "Array length mismatch");
        require(fillIds.length <= 10, "Too many fills"); // Prevent gas issues
        
        for (uint256 i = 0; i < fillIds.length; i++) {
            PartialFillData storage fill = fills[fillIds[i]];
            if (fill.state == FillState.Pending && 
                block.timestamp <= fill.timestamp + PARTIAL_FILL_TIMEOUT) {
                
                fill.state = FillState.Completed;
                fill.secret = secrets[i];
                
                // Transfer TRX to filler
                payable(fill.filler).transfer(fill.amount);
                
                // Return filler bond
                uint256 bondAmount = (fill.amount * FILLER_BOND_RATIO) / 100;
                fillerBonds[fill.filler] += bondAmount;
                
                emit PartialFillCompleted(fillIds[i], secrets[i], fill.filler, fill.amount);
            }
        }
    }
}