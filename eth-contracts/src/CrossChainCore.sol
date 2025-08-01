// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import { Address, AddressLib } from "../lib/cross-chain-swap/lib/solidity-utils/contracts/libraries/AddressLib.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import { Timelocks, TimelocksLib } from "../lib/cross-chain-swap/contracts/libraries/TimelocksLib.sol";

/**
 * @title CrossChainCore - Core bridge functionality
 * @dev Main contract for ETH <-> NEAR bridge with 1inch integration
 */
contract CrossChainCore is Ownable {
    using AddressLib for Address;
    using TimelocksLib for Timelocks;
    
    // Official 1inch contracts
    IEscrowFactory public immutable ESCROW_FACTORY;
    address public immutable LIMIT_ORDER_PROTOCOL;
    
    // Chain identifiers
    enum DestinationChain { NEAR, TRON }
    
    // Core events
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
    
    constructor(
        address _escrowFactory,
        address _limitOrderProtocol
    ) Ownable(msg.sender) {
        ESCROW_FACTORY = IEscrowFactory(_escrowFactory);
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
    }
    
    /**
     * @dev Create ETH to NEAR bridge
     */
    function createETHToNEARBridge(
        bytes32 hashlock,
        string calldata nearAccount
    ) external payable returns (address escrow) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(bytes(nearAccount).length > 0, "NEAR account required");
        require(_isValidNearAccount(nearAccount), "Invalid NEAR account format");
        
        // Create 1inch-compatible Immutables
        IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
            orderHash: keccak256(abi.encodePacked(msg.sender, hashlock, block.timestamp)),
            hashlock: hashlock,
            maker: Address.wrap(uint160(msg.sender)),
            taker: Address.wrap(uint160(address(this))),
            token: Address.wrap(uint160(address(0))), // ETH
            amount: msg.value,
            safetyDeposit: 0,
            timelocks: _createTimelocks()
        });
        
        uint256 srcCancellationTimestamp = block.timestamp + 24 hours;
        
        try ESCROW_FACTORY.createDstEscrow{value: msg.value}(immutables, srcCancellationTimestamp) {
            escrow = ESCROW_FACTORY.addressOfEscrowDst(immutables);
        } catch {
            escrow = address(this);
        }
        
        // Create swap tracking
        bytes32 swapId = keccak256(abi.encodePacked(
            escrow, hashlock, uint256(DestinationChain.NEAR), nearAccount, block.timestamp
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
        
        emit EscrowCreated(escrow, hashlock, DestinationChain.NEAR, nearAccount, msg.value);
        emit EscrowCreatedLegacy(escrow, hashlock, nearAccount, msg.value);
    }
    
    /**
     * @dev Create timelocks for 1inch
     */
    function _createTimelocks() internal view returns (Timelocks) {
        uint32 current = uint32(block.timestamp);
        uint256 packed = 
            (uint256(current + 12 hours) << 192) |
            (uint256(current + 18 hours) << 160) |
            (uint256(current + 24 hours) << 128) |
            (uint256(current + 30 hours) << 96) |
            (uint256(current + 6 hours) << 64) |
            (uint256(current + 12 hours) << 32) |
            uint256(current + 18 hours);
        return Timelocks.wrap(packed);
    }
    
    /**
     * @dev Validate NEAR account format
     */
    function _isValidNearAccount(string memory nearAccount) internal pure returns (bool) {
        bytes memory account = bytes(nearAccount);
        if (account.length < 2 || account.length > 64) return false;
        
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
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
