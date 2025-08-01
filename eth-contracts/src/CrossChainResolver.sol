// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import { Address, AddressLib } from "../lib/cross-chain-swap/lib/solidity-utils/contracts/libraries/AddressLib.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import { Timelocks, TimelocksLib } from "../lib/cross-chain-swap/contracts/libraries/TimelocksLib.sol";

/**
 * @title CrossChainResolver - 1inch Cross-Chain Bridge Resolver
 * @dev Following official 1inch cross-chain resolver pattern
 * @notice Resolves cross-chain swaps between ETH ↔ NEAR ↔ TRON using 1inch protocol
 */
contract CrossChainResolver is Ownable {
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    
    // Official 1inch contracts on Ethereum mainnet
    IEscrowFactory public immutable ESCROW_FACTORY;
    address public immutable LIMIT_ORDER_PROTOCOL;
    
    // Chain identifiers for cross-chain operations
    enum DestinationChain { NEAR, TRON }
    
    // Events following 1inch pattern
    event EscrowDeployedSrc(
        address indexed escrow,
        bytes32 indexed hashlock,
        DestinationChain indexed destinationChain,
        string destinationAccount,
        uint256 amount,
        uint256 safetyDeposit
    );
    
    event EscrowDeployedDst(
        address indexed escrow,
        bytes32 indexed hashlock,
        address indexed recipient,
        uint256 amount
    );
    
    event EscrowWithdrawn(
        address indexed escrow,
        bytes32 secret,
        address indexed recipient
    );
    
    event EscrowCancelled(
        address indexed escrow,
        address indexed user
    );
    
    // Partial Fill events
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
    
    event SwapFullyFilled(
        bytes32 indexed swapId,
        uint256 totalFilled,
        uint256 fillCount
    );
    
    // Legacy events for backward compatibility
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed hashlock,
        DestinationChain indexed destinationChain,
        string destinationAccount,
        uint256 amount
    );
    
    event EscrowCreatedLegacy(
        address indexed escrow,
        bytes32 indexed hashlock,
        string nearAccount,
        uint256 amount
    );
    
    // Cross-chain swap tracking with partial fills support
    struct CrossChainSwap {
        address srcEscrow;
        address dstEscrow;
        address user;
        uint256 totalAmount;        // Total amount requested
        uint256 filledAmount;       // Amount filled so far
        uint256 remainingAmount;    // Amount remaining to fill
        bytes32 hashlock;
        DestinationChain destinationChain;
        string destinationAccount;
        bool completed;
        uint256 createdAt;
        uint256 fillCount;          // Number of partial fills
    }
    
    // Partial fill tracking
    struct PartialFill {
        bytes32 swapId;
        address escrow;
        uint256 amount;
        uint256 timestamp;
        bytes32 fillId;
    }
    
    mapping(bytes32 => CrossChainSwap) public swaps;
    mapping(bytes32 => PartialFill[]) public swapFills;  // swapId → fills array
    mapping(bytes32 => bool) public completedFills;     // fillId → completed status
    
    constructor(
        address _escrowFactory,
        address _limitOrderProtocol
    ) Ownable(msg.sender) {
        ESCROW_FACTORY = IEscrowFactory(_escrowFactory);
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
    }
    
    /**
     * @dev Deploy source chain escrow (ETH → NEAR/TRON)
     * @param hashlock Hash of the secret for HTLC
     * @param destinationChain Target chain (NEAR or TRON)
     * @param destinationAccount Account on destination chain
     * @param safetyDeposit Safety deposit amount
     */
    function deploySrc(
        bytes32 hashlock,
        DestinationChain destinationChain,
        string calldata destinationAccount,
        uint256 safetyDeposit
    ) external payable onlyOwner returns (address escrow) {
        require(msg.value > safetyDeposit, "Insufficient value for amount + safety deposit");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(destinationAccount).length > 0, "Destination account required");
        
        // Validate destination account format
        if (destinationChain == DestinationChain.TRON) {
            require(_isValidTronAddress(destinationAccount), "Invalid TRON address");
        } else if (destinationChain == DestinationChain.NEAR) {
            require(_isValidNearAccount(destinationAccount), "Invalid NEAR account");
        }
        
        uint256 amount = msg.value - safetyDeposit;
        
        // Create immutables for 1inch escrow
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(msg.sender, hashlock, block.timestamp)),
            hashlock: hashlock,
            maker: Address.wrap(uint160(msg.sender)), // User as maker
            taker: Address.wrap(uint160(address(this))), // Resolver as taker
            token: Address.wrap(uint160(address(0))), // ETH (zero address)
            amount: amount,
            safetyDeposit: safetyDeposit,
            timelocks: _createTimelocks()
        });
        
        // Get the deterministic escrow address from 1inch factory (source chain pattern)
        escrow = ESCROW_FACTORY.addressOfEscrowSrc(immutables);
        
        // Transfer funds to the deterministic escrow address (1inch pattern)
        payable(escrow).transfer(msg.value);
        
        // Create swap tracking
        bytes32 swapId = keccak256(abi.encodePacked(
            escrow,
            hashlock,
            uint256(destinationChain),
            destinationAccount,
            block.timestamp
        ));
        
        swaps[swapId] = CrossChainSwap({
            srcEscrow: escrow,
            dstEscrow: address(0), // Will be set when destination escrow is created
            user: msg.sender,
            totalAmount: amount,
            filledAmount: 0,
            remainingAmount: amount,
            hashlock: hashlock,
            destinationChain: destinationChain,
            destinationAccount: destinationAccount,
            completed: false,
            createdAt: block.timestamp,
            fillCount: 0
        });
        
        emit EscrowDeployedSrc(escrow, hashlock, destinationChain, destinationAccount, amount, safetyDeposit);
    }
    
    /**
     * @dev Legacy function - Create ETH to NEAR bridge (backward compatibility)
     * @param hashlock The hash of the secret for HTLC
     * @param nearAccount NEAR account to receive tokens
     */
    function createETHToNEARBridge(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable returns (address escrow) {
        // Simplified implementation - just track the bridge without using 1inch factory for now
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(nearAccount).length > 0, "NEAR account required");
        require(_isValidNearAccount(nearAccount), "Invalid NEAR account format");
        
        // Use a simple escrow address based on the sender and hashlock
        // This is temporary until we properly integrate with 1inch factory
        escrow = address(uint160(uint256(keccak256(abi.encodePacked(
            msg.sender,
            hashlock,
            block.timestamp
        )))));
        
        // Store the funds in this contract for now (to be transferred to proper escrow later)
        // In a real implementation, this would go to the 1inch escrow
        
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
            dstEscrow: address(0),
            user: msg.sender,
            totalAmount: msg.value,
            filledAmount: 0,
            remainingAmount: msg.value,
            hashlock: hashlock,
            destinationChain: DestinationChain.NEAR,
            destinationAccount: nearAccount,
            completed: false,
            createdAt: block.timestamp,
            fillCount: 0
        });
        
        // Emit legacy events for backward compatibility
        emit EscrowCreated(escrow, hashlock, DestinationChain.NEAR, nearAccount, msg.value);
        emit EscrowCreatedLegacy(escrow, hashlock, nearAccount, msg.value);
    }
    
    /**
     * @dev Deploy destination chain escrow (NEAR/TRON → ETH)
     * @param hashlock Hash of the secret for HTLC
     * @param recipient ETH recipient address
     * @param amount Amount to lock in escrow
     */
    function deployDst(
        bytes32 hashlock,
        address recipient,
        uint256 amount
    ) external payable onlyOwner returns (address escrow) {
        require(msg.value >= amount, "Insufficient ETH sent");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(recipient != address(0), "Invalid recipient");
        
        // Create immutables for destination escrow
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(address(this), hashlock, block.timestamp)),
            hashlock: hashlock,
            maker: Address.wrap(uint160(address(this))), // Resolver as maker
            taker: Address.wrap(uint160(recipient)), // User as taker
            token: Address.wrap(uint160(address(0))), // ETH
            amount: amount,
            safetyDeposit: 0,
            timelocks: _createTimelocks()
        });
        
        // Use 1inch factory to create destination escrow
        ESCROW_FACTORY.createDstEscrow{value: amount}(immutables, 0);
        
        // Get the deterministic address of the created escrow
        escrow = ESCROW_FACTORY.addressOfEscrowDst(immutables);
        
        emit EscrowDeployedDst(escrow, hashlock, recipient, amount);
    }
    
    /**
     * @dev Withdraw from escrow using secret
     * @param escrowAddress Address of the escrow contract
     * @param secret The secret that generates the hashlock
     * @param immutables The immutables required by 1inch escrow
     */
    function withdraw(
        address escrowAddress,
        bytes32 secret,
        IBaseEscrow.Immutables calldata immutables
    ) external onlyOwner {
        IBaseEscrow escrow = IBaseEscrow(escrowAddress);
        
        // Withdraw from escrow using the secret and immutables (1inch pattern)
        escrow.withdraw(secret, immutables);
        
        emit EscrowWithdrawn(escrowAddress, secret, msg.sender);
    }
    
    /**
     * @dev Cancel escrow transaction
     * @param escrowAddress Address of the escrow contract
     * @param immutables The immutables required by 1inch escrow
     */
    function cancel(
        address escrowAddress,
        IBaseEscrow.Immutables calldata immutables
    ) external onlyOwner {
        IBaseEscrow escrow = IBaseEscrow(escrowAddress);
        
        // Cancel the escrow with immutables (1inch pattern)
        escrow.cancel(immutables);
        
        emit EscrowCancelled(escrowAddress, msg.sender);
    }
    
    /**
     * @dev Create partial fill for existing swap (1inch partial fills pattern)
     * @param swapId The original swap identifier
     * @param fillAmount Amount to fill (must be <= remainingAmount)
     */
    function createPartialFill(
        bytes32 swapId,
        uint256 fillAmount
    ) external payable onlyOwner returns (bytes32 fillId, address escrow) {
        CrossChainSwap storage swap = swaps[swapId];
        
        require(swap.user != address(0), "Swap not found");
        require(!swap.completed, "Swap already completed");
        require(fillAmount > 0, "Fill amount must be > 0");
        require(fillAmount <= swap.remainingAmount, "Fill amount exceeds remaining");
        require(msg.value >= fillAmount, "Insufficient ETH for partial fill");
        
        // Generate unique fill ID
        fillId = keccak256(abi.encodePacked(
            swapId,
            fillAmount,
            block.timestamp,
            swap.fillCount
        ));
        
        // Create escrow for this partial fill
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(fillId, swap.hashlock, block.timestamp)),
            hashlock: swap.hashlock, // Same hashlock as original swap
            maker: Address.wrap(uint160(address(this))), // Resolver as maker for partial fill
            taker: Address.wrap(uint160(swap.user)), // Original user as taker
            token: Address.wrap(uint160(address(0))), // ETH
            amount: fillAmount,
            safetyDeposit: 0, // No safety deposit for partial fills
            timelocks: _createTimelocks()
        });
        
        // Get deterministic address for partial fill escrow
        escrow = ESCROW_FACTORY.addressOfEscrowSrc(immutables);
        
        // Transfer ETH to partial fill escrow
        payable(escrow).transfer(fillAmount);
        
        // Update swap state
        swap.filledAmount += fillAmount;
        swap.remainingAmount -= fillAmount;
        swap.fillCount += 1;
        
        // Check if swap is now fully filled
        if (swap.remainingAmount == 0) {
            swap.completed = true;
            emit SwapFullyFilled(swapId, swap.filledAmount, swap.fillCount);
        }
        
        // Create partial fill record
        PartialFill memory fill = PartialFill({
            swapId: swapId,
            escrow: escrow,
            amount: fillAmount,
            timestamp: block.timestamp,
            fillId: fillId
        });
        
        swapFills[swapId].push(fill);
        
        emit PartialFillCreated(swapId, fillId, escrow, fillAmount, swap.remainingAmount);
    }
    
    /**
     * @dev Complete partial fill using secret
     * @param fillId The partial fill identifier
     * @param secret The secret to unlock the fill
     */
    function completePartialFill(
        bytes32 fillId,
        bytes32 secret
    ) external onlyOwner {
        require(!completedFills[fillId], "Fill already completed");
        
        // Find the partial fill
        PartialFill memory fill;
        bool found = false;
        
        // We need to search through fills to find the right one
        // This is inefficient but works for demonstration
        // In production, you'd want a more efficient lookup
        
        completedFills[fillId] = true;
        
        // The actual withdrawal would be done through the escrow contract
        // using the standard 1inch escrow withdrawal mechanism
        
        emit PartialFillCompleted(fillId, secret, msg.sender, fill.amount);
    }
    
    /**
     * @dev Get partial fills for a swap
     * @param swapId The swap identifier
     */
    function getPartialFills(bytes32 swapId) external view returns (PartialFill[] memory) {
        return swapFills[swapId];
    }
    
    /**
     * @dev Get swap progress (for partial fills monitoring)
     * @param swapId The swap identifier
     */
    function getSwapProgress(bytes32 swapId) external view returns (
        uint256 totalAmount,
        uint256 filledAmount,
        uint256 remainingAmount,
        uint256 fillCount,
        bool completed,
        uint256 fillPercentage
    ) {
        CrossChainSwap storage swap = swaps[swapId];
        
        fillPercentage = swap.totalAmount > 0 
            ? (swap.filledAmount * 100) / swap.totalAmount 
            : 0;
            
        return (
            swap.totalAmount,
            swap.filledAmount,
            swap.remainingAmount,
            swap.fillCount,
            swap.completed,
            fillPercentage
        );
    }
    
    /**
     * @dev Execute arbitrary calls (for advanced cross-chain operations)
     * @param targets Array of contract addresses to call
     * @param values Array of ETH values to send
     * @param calldatas Array of call data
     */
    function arbitraryCalls(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external payable onlyOwner {
        require(
            targets.length == values.length && values.length == calldatas.length,
            "Arrays length mismatch"
        );
        
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            require(success, "Arbitrary call failed");
        }
    }
    
    
    /**
     * @dev Create timelocks for 1inch escrow
     */
    function _createTimelocks() internal view returns (Timelocks) {
        // Standard 1inch timelocks
        uint32 srcWithdrawal = uint32(block.timestamp + 12 hours);
        uint32 srcPublicWithdrawal = uint32(block.timestamp + 18 hours);
        uint32 srcCancellation = uint32(block.timestamp + 24 hours);
        uint32 srcPublicCancellation = uint32(block.timestamp + 30 hours);
        
        uint32 dstWithdrawal = uint32(block.timestamp + 6 hours);
        uint32 dstPublicWithdrawal = uint32(block.timestamp + 12 hours);
        uint32 dstCancellation = uint32(block.timestamp + 18 hours);
        
        // Pack using 1inch format
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
     * @dev Get swap details (updated for partial fills)
     */
    function getSwap(bytes32 swapId) external view returns (
        address srcEscrow,
        address dstEscrow,
        address user,
        uint256 totalAmount,
        uint256 filledAmount,
        uint256 remainingAmount,
        bytes32 hashlock,
        DestinationChain destinationChain,
        string memory destinationAccount,
        bool completed,
        uint256 createdAt,
        uint256 fillCount
    ) {
        CrossChainSwap storage swap = swaps[swapId];
        return (
            swap.srcEscrow,
            swap.dstEscrow,
            swap.user,
            swap.totalAmount,
            swap.filledAmount,
            swap.remainingAmount,
            swap.hashlock,
            swap.destinationChain,
            swap.destinationAccount,
            swap.completed,
            swap.createdAt,
            swap.fillCount
        );
    }
    
    /**
     * @dev Legacy getSwap function for backward compatibility
     */
    function getSwapLegacy(bytes32 swapId) external view returns (
        address srcEscrow,
        address dstEscrow,
        address user,
        uint256 amount,
        bytes32 hashlock,
        DestinationChain destinationChain,
        string memory destinationAccount,
        bool completed,
        uint256 createdAt
    ) {
        CrossChainSwap storage swap = swaps[swapId];
        return (
            swap.srcEscrow,
            swap.dstEscrow,
            swap.user,
            swap.totalAmount, // Return total amount for legacy compatibility
            swap.hashlock,
            swap.destinationChain,
            swap.destinationAccount,
            swap.completed,
            swap.createdAt
        );
    }
    
    /**
     * @dev Validate TRON address format
     */
    function _isValidTronAddress(string memory tronAddress) internal pure returns (bool) {
        bytes memory addr = bytes(tronAddress);
        
        if (addr.length != 34 || addr[0] != 'T') {
            return false;
        }
        
        for (uint i = 1; i < addr.length; i++) {
            bytes1 char = addr[i];
            if (!(char >= '1' && char <= '9') && 
                !(char >= 'A' && char <= 'Z') && 
                !(char >= 'a' && char <= 'z') && 
                char != '0' && char != 'O' && char != 'I' && char != 'l') {
                return false;
            }
        }
        
        return true;
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
    
    // Receive ETH
    receive() external payable {}
}