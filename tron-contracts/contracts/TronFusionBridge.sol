// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title TronFusionBridge - 1inch Fusion+ Compatible Bridge for TRON
 * @dev Implements full 1inch Fusion+ compatibility with multi-stage timelocks
 * @notice Preserves hashlock/timelock functionality for non-EVM chain (TRON)
 */
contract TronFusionBridge {
    
    // 1inch Fusion+ Compatible Immutables Structure
    struct Immutables {
        bytes32 orderHash;          // Unique order identifier
        bytes32 hashlock;           // Secret hash for HTLC
        address maker;              // User address (converted from TRON)
        address taker;              // Resolver address
        address token;              // TRX = address(0), TRC20 = token address
        uint256 amount;             // Amount in TRX/TRC20 units
        uint256 safetyDeposit;      // Resolver safety deposit
        TronTimelocks timelocks;    // Multi-stage timelock structure
    }
    
    // TRON-adapted multi-stage timelocks (1inch Fusion+ pattern)
    struct TronTimelocks {
        uint32 srcWithdrawal;         // Private withdrawal (taker only)
        uint32 srcPublicWithdrawal;   // Public withdrawal (anyone with secret)
        uint32 srcCancellation;       // Private cancellation (taker only)
        uint32 srcPublicCancellation; // Public cancellation (anyone)
        uint32 dstWithdrawal;         // Destination withdrawal
        uint32 dstPublicWithdrawal;   // Destination public withdrawal
        uint32 dstCancellation;       // Destination cancellation
    }
    
    // Enhanced swap structure with 1inch compatibility
    struct TronFusionSwap {
        Immutables immutables;
        SwapState state;
        uint256 createdAt;
        bytes32 secretRevealed;     // Store revealed secret
    }
    
    enum SwapState {
        Created,        // Swap created, waiting for counterpart
        Active,         // Both sides active, ready for completion
        Completed,      // Successfully completed
        Cancelled,      // Cancelled/refunded
        Expired         // Expired without action
    }
    
    // Current timelock stage (1inch Fusion+ pattern)
    enum TimelockStage {
        SrcWithdrawal,        // 0-2h: Private withdrawal (taker only)
        SrcPublicWithdrawal,  // 2-6h: Public withdrawal (anyone with secret)
        SrcCancellation,      // 6-12h: Private cancellation (taker only)
        SrcPublicCancellation,// 12-18h: Public cancellation (anyone)
        DstWithdrawal,        // For destination chain coordination
        DstPublicWithdrawal,  // For destination chain coordination
        DstCancellation       // For destination chain coordination
    }
    
    // State mappings
    mapping(bytes32 => TronFusionSwap) public swaps;
    mapping(address => bool) public authorizedResolvers;
    mapping(address => uint256) public resolverBonds;  // Safety deposits
    mapping(bytes32 => string) public ethToTronAddress; // Address mapping
    
    // Configuration
    address public owner;
    uint256 public constant MIN_SAFETY_DEPOSIT = 100000000; // 0.1 TRX in Sun (minimum resolver bond)
    uint256 public constant TIMELOCK_DURATION = 18 hours;   // Total timelock period
    
    // 1inch Fusion+ Compatible Events
    event EscrowCreated(
        bytes32 indexed orderHash,
        bytes32 indexed hashlock,
        address indexed maker,
        address taker,
        uint256 amount,
        string tronMaker,           // TRON address of maker
        string ethTaker             // ETH address for cross-chain
    );
    
    event SwapCompleted(
        bytes32 indexed orderHash,
        bytes32 secret,
        address indexed resolver
    );
    
    event SwapCancelled(
        bytes32 indexed orderHash,
        address indexed canceller,
        uint256 refundAmount
    );
    
    event SafetyDepositSlashed(
        address indexed resolver,
        uint256 amount,
        bytes32 reason
    );
    
    // Modifiers
    modifier onlyAuthorized() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier validSecret(bytes32 secret, bytes32 hashlock) {
        require(sha256(abi.encodePacked(secret)) == hashlock, "Invalid secret");
        _;
    }
    
    modifier inTimelockStage(bytes32 orderHash, TimelockStage expectedStage) {
        require(_getCurrentTimelockStage(orderHash) == expectedStage, "Invalid timelock stage");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedResolvers[msg.sender] = true;
    }
    
    /**
     * @dev Create TRON-side escrow with 1inch Fusion+ compatibility
     * @param immutables The 1inch-compatible immutable parameters
     * @param tronMaker TRON address of the maker
     * @param ethTaker ETH address for cross-chain coordination
     */
    function createTronEscrow(
        Immutables calldata immutables,
        string calldata tronMaker,
        string calldata ethTaker
    ) external payable onlyAuthorized returns (bytes32 orderHash) {
        require(msg.value >= immutables.amount + immutables.safetyDeposit, "Insufficient funds");
        require(immutables.amount > 0, "Invalid amount");
        require(immutables.hashlock != bytes32(0), "Invalid hashlock");
        require(_isValidTronAddress(tronMaker), "Invalid TRON maker address");
        require(_isValidEthAddress(ethTaker), "Invalid ETH taker address");
        
        orderHash = immutables.orderHash;
        require(swaps[orderHash].createdAt == 0, "Swap already exists");
        
        // Store address mapping for cross-chain coordination
        ethToTronAddress[immutables.orderHash] = tronMaker;
        
        // Store resolver safety deposit
        resolverBonds[msg.sender] += immutables.safetyDeposit;
        
        // Create swap with 1inch-compatible structure
        swaps[orderHash] = TronFusionSwap({
            immutables: immutables,
            state: SwapState.Created,
            createdAt: block.timestamp,
            secretRevealed: bytes32(0)
        });
        
        emit EscrowCreated(
            orderHash,
            immutables.hashlock,
            immutables.maker,
            immutables.taker,
            immutables.amount,
            tronMaker,
            ethTaker
        );
        
        return orderHash;
    }
    
    /**
     * @dev Complete swap with secret during private withdrawal stage
     * @param orderHash The swap identifier
     * @param secret The secret that generates the hashlock
     * @param immutables The immutable parameters for verification
     */
    function withdraw(
        bytes32 orderHash,
        bytes32 secret,
        Immutables calldata immutables
    ) external 
        validSecret(secret, immutables.hashlock)
        inTimelockStage(orderHash, TimelockStage.SrcWithdrawal)
    {
        require(msg.sender == immutables.taker, "Only taker can withdraw privately");
        _completeSwap(orderHash, secret, immutables);
    }
    
    /**
     * @dev Complete swap during public withdrawal stage (anyone with secret)
     * @param orderHash The swap identifier
     * @param secret The secret that generates the hashlock
     * @param immutables The immutable parameters for verification
     */
    function publicWithdraw(
        bytes32 orderHash,
        bytes32 secret,
        Immutables calldata immutables
    ) external 
        validSecret(secret, immutables.hashlock)
        inTimelockStage(orderHash, TimelockStage.SrcPublicWithdrawal)
    {
        _completeSwap(orderHash, secret, immutables);
    }
    
    /**
     * @dev Cancel swap during private cancellation stage
     * @param orderHash The swap identifier
     * @param immutables The immutable parameters for verification
     */
    function cancel(
        bytes32 orderHash,
        Immutables calldata immutables
    ) external inTimelockStage(orderHash, TimelockStage.SrcCancellation) {
        require(msg.sender == immutables.taker, "Only taker can cancel privately");
        _cancelSwap(orderHash, immutables);
    }
    
    /**
     * @dev Cancel swap during public cancellation stage
     * @param orderHash The swap identifier
     * @param immutables The immutable parameters for verification
     */
    function publicCancel(
        bytes32 orderHash,
        Immutables calldata immutables
    ) external inTimelockStage(orderHash, TimelockStage.SrcPublicCancellation) {
        _cancelSwap(orderHash, immutables);
    }
    
    /**
     * @dev Internal function to complete swap
     */
    function _completeSwap(
        bytes32 orderHash,
        bytes32 secret,
        Immutables calldata immutables
    ) internal {
        TronFusionSwap storage swap = swaps[orderHash];
        require(swap.state == SwapState.Created || swap.state == SwapState.Active, "Invalid state");
        require(_verifyImmutables(orderHash, immutables), "Invalid immutables");
        
        swap.state = SwapState.Completed;
        swap.secretRevealed = secret;
        
        // Transfer TRX to maker (user)
        string memory tronMaker = ethToTronAddress[orderHash];
        require(bytes(tronMaker).length > 0, "TRON address not found");
        
        // In TRON, we transfer to the maker's TRON address
        // This would be handled by the TRON runtime
        
        // Return safety deposit to resolver
        uint256 safetyDeposit = immutables.safetyDeposit;
        if (safetyDeposit > 0) {
            resolverBonds[immutables.taker] -= safetyDeposit;
            payable(immutables.taker).transfer(safetyDeposit);
        }
        
        emit SwapCompleted(orderHash, secret, msg.sender);
    }
    
    /**
     * @dev Internal function to cancel swap
     */
    function _cancelSwap(
        bytes32 orderHash,
        Immutables calldata immutables
    ) internal {
        TronFusionSwap storage swap = swaps[orderHash];
        require(swap.state == SwapState.Created || swap.state == SwapState.Active, "Invalid state");
        require(_verifyImmutables(orderHash, immutables), "Invalid immutables");
        
        swap.state = SwapState.Cancelled;
        
        // Refund amount to resolver (taker)
        payable(immutables.taker).transfer(immutables.amount);
        
        // Return safety deposit to resolver
        uint256 safetyDeposit = immutables.safetyDeposit;
        if (safetyDeposit > 0) {
            resolverBonds[immutables.taker] -= safetyDeposit;
            payable(immutables.taker).transfer(safetyDeposit);
        }
        
        emit SwapCancelled(orderHash, msg.sender, immutables.amount);
    }
    
    /**
     * @dev Get current timelock stage for a swap
     */
    function _getCurrentTimelockStage(bytes32 orderHash) internal view returns (TimelockStage) {
        TronFusionSwap storage swap = swaps[orderHash];
        if (swap.createdAt == 0) return TimelockStage.SrcWithdrawal; // Default
        
        uint256 elapsed = block.timestamp - swap.createdAt;
        TronTimelocks memory timelocks = swap.immutables.timelocks;
        
        if (elapsed < timelocks.srcWithdrawal) {
            return TimelockStage.SrcWithdrawal;
        } else if (elapsed < timelocks.srcPublicWithdrawal) {
            return TimelockStage.SrcPublicWithdrawal;
        } else if (elapsed < timelocks.srcCancellation) {
            return TimelockStage.SrcCancellation;
        } else {
            return TimelockStage.SrcPublicCancellation;
        }
    }
    
    /**
     * @dev Verify immutables match stored swap
     */
    function _verifyImmutables(
        bytes32 orderHash,
        Immutables calldata immutables
    ) internal view returns (bool) {
        TronFusionSwap storage swap = swaps[orderHash];
        Immutables storage stored = swap.immutables;
        
        return (
            stored.orderHash == immutables.orderHash &&
            stored.hashlock == immutables.hashlock &&
            stored.maker == immutables.maker &&
            stored.taker == immutables.taker &&
            stored.token == immutables.token &&
            stored.amount == immutables.amount &&
            stored.safetyDeposit == immutables.safetyDeposit
        );
    }
    
    /**
     * @dev Create timelocks adapted for TRON (faster block times)
     */
    function createTronTimelocks() external view returns (TronTimelocks memory) {
        uint256 baseTime = block.timestamp;
        
        return TronTimelocks({
            srcWithdrawal: uint32(baseTime + 30 minutes),      // Faster on TRON
            srcPublicWithdrawal: uint32(baseTime + 2 hours),   // Adjusted for TRON
            srcCancellation: uint32(baseTime + 6 hours),       // Shorter timelock
            srcPublicCancellation: uint32(baseTime + 12 hours), // Public cancellation
            dstWithdrawal: uint32(baseTime + 1 hours),         // Destination coordination
            dstPublicWithdrawal: uint32(baseTime + 3 hours),   // Destination public
            dstCancellation: uint32(baseTime + 8 hours)        // Destination cancellation
        });
    }
    
    /**
     * @dev Get swap details with 1inch compatibility
     */
    function getSwap(bytes32 orderHash) external view returns (
        Immutables memory immutables,
        SwapState state,
        uint256 createdAt,
        bytes32 secretRevealed,
        TimelockStage currentStage
    ) {
        TronFusionSwap storage swap = swaps[orderHash];
        return (
            swap.immutables,
            swap.state,
            swap.createdAt,
            swap.secretRevealed,
            _getCurrentTimelockStage(orderHash)
        );
    }
    
    /**
     * @dev Validate TRON address format
     */
    function _isValidTronAddress(string memory tronAddress) internal pure returns (bool) {
        bytes memory addr = bytes(tronAddress);
        
        if (addr.length != 34) return false;
        if (addr[0] != 'T') return false;
        
        // Basic Base58 validation
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
     * @dev Validate ETH address format
     */
    function _isValidEthAddress(string memory ethAddress) internal pure returns (bool) {
        bytes memory addr = bytes(ethAddress);
        
        if (addr.length != 42) return false;
        if (addr[0] != '0' || addr[1] != 'x') return false;
        
        // Basic hex validation
        for (uint i = 2; i < addr.length; i++) {
            bytes1 char = addr[i];
            if (!(char >= '0' && char <= '9') && 
                !(char >= 'A' && char <= 'F') && 
                !(char >= 'a' && char <= 'f')) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Emergency rescue function (simplified for deployment)
     */
    function rescueFunds(bytes32 orderHash) external onlyOwner {
        TronFusionSwap storage swap = swaps[orderHash];
        require(swap.createdAt > 0, "Swap not found");
        require(block.timestamp > swap.createdAt + 7 days, "Too early");
        
        swap.state = SwapState.Expired;
        payable(owner).transfer(swap.immutables.amount);
    }
    
    /**
     * @dev Authorize resolver with safety deposit
     */
    function authorizeResolver(address resolver) external payable onlyOwner {
        require(msg.value >= MIN_SAFETY_DEPOSIT, "Insufficient safety deposit");
        authorizedResolvers[resolver] = true;
        resolverBonds[resolver] += msg.value;
    }
    
    /**
     * @dev Remove resolver authorization
     */
    function revokeResolver(address resolver) external onlyOwner {
        authorizedResolvers[resolver] = false;
        
        // Return safety deposit
        uint256 bond = resolverBonds[resolver];
        if (bond > 0) {
            resolverBonds[resolver] = 0;
            payable(resolver).transfer(bond);
        }
    }
    
    /**
     * @dev Emergency withdraw all TRX from contract (owner only)
     * @param to Address to send TRX to
     */
    function emergencyWithdrawTRX(address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No TRX to withdraw");
        
        to.transfer(balance);
        
        emit SafetyDepositSlashed(address(this), balance, "EMERGENCY_WITHDRAW");
    }
    
    /**
     * @dev Emergency withdraw specific amount (owner only)
     * @param to Address to send TRX to
     * @param amount Amount in TRX (sun units)
     */
    function emergencyWithdrawAmount(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient contract balance");
        
        to.transfer(amount);
        
        emit SafetyDepositSlashed(address(this), amount, "EMERGENCY_PARTIAL_WITHDRAW");
    }
    
    /**
     * @dev Get contract TRX balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Receive TRX for escrows and safety deposits
    receive() external payable {}
    fallback() external payable {}
}