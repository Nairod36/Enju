// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/HTLC.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract HTLCTest is Test {
    HTLCEthereum public htlc;
    MockERC20 public token;
    
    address public sender = address(0x1);
    address public receiver = address(0x2);
    bytes32 public secret = keccak256("test_secret");
    bytes32 public hashlock = sha256(abi.encodePacked(secret));
    uint256 public timelock = block.timestamp + 24 hours;
    string public nearAccount = "receiver.near";
    uint256 public amount = 100 * 10**18;
    
    event HTLCCreated(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        string nearAccount
    );
    
    event HTLCWithdrawn(bytes32 indexed contractId, bytes32 preimage);
    event HTLCRefunded(bytes32 indexed contractId);
    
    function setUp() public {
        htlc = new HTLCEthereum();
        token = new MockERC20();
        
        // Fund sender with tokens
        vm.deal(sender, 10 ether);
        token.mint(sender, 1000 * 10**18);
        
        // Set up allowance
        vm.prank(sender);
        token.approve(address(htlc), type(uint256).max);
    }
    
    function testCreateHTLCWithERC20() public {
        vm.prank(sender);
        
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        
        assertEq(htlcContract.sender, sender);
        assertEq(htlcContract.receiver, receiver);
        assertEq(htlcContract.token, address(token));
        assertEq(htlcContract.amount, amount);
        assertEq(htlcContract.hashlock, hashlock);
        assertEq(htlcContract.timelock, timelock);
        assertEq(htlcContract.nearAccount, nearAccount);
        assertFalse(htlcContract.withdrawn);
        assertFalse(htlcContract.refunded);
        
        // Check token transfer
        assertEq(token.balanceOf(address(htlc)), amount);
    }
    
    function testCreateHTLCWithETH() public {
        vm.prank(sender);
        
        bytes32 contractId = htlc.createHTLCEth{value: 1 ether}(
            receiver,
            hashlock,
            timelock,
            nearAccount
        );
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        
        assertEq(htlcContract.sender, sender);
        assertEq(htlcContract.receiver, receiver);
        assertEq(htlcContract.token, address(0));
        assertEq(htlcContract.amount, 1 ether);
        assertEq(htlcContract.hashlock, hashlock);
        assertEq(htlcContract.timelock, timelock);
        assertEq(htlcContract.nearAccount, nearAccount);
        assertFalse(htlcContract.withdrawn);
        assertFalse(htlcContract.refunded);
        
        // Check ETH balance
        assertEq(address(htlc).balance, 1 ether);
    }
    
    function testWithdrawWithValidSecret() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        uint256 initialBalance = token.balanceOf(receiver);
        
        vm.prank(receiver);
        htlc.withdraw(contractId, secret);
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        assertTrue(htlcContract.withdrawn);
        assertFalse(htlcContract.refunded);
        
        assertEq(token.balanceOf(receiver), initialBalance + amount);
    }
    
    function testWithdrawETHWithValidSecret() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLCEth{value: 1 ether}(
            receiver,
            hashlock,
            timelock,
            nearAccount
        );
        
        uint256 initialBalance = receiver.balance;
        
        vm.prank(receiver);
        htlc.withdraw(contractId, secret);
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        assertTrue(htlcContract.withdrawn);
        assertFalse(htlcContract.refunded);
        
        assertEq(receiver.balance, initialBalance + 1 ether);
    }
    
    function testFailWithdrawWithInvalidSecret() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        bytes32 wrongSecret = keccak256("wrong_secret");
        
        vm.prank(receiver);
        htlc.withdraw(contractId, wrongSecret);
    }
    
    function testFailWithdrawByWrongReceiver() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.prank(sender); // Wrong caller
        htlc.withdraw(contractId, secret);
    }
    
    function testRefundAfterTimelock() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        // Move time forward past timelock
        vm.warp(timelock + 1);
        
        uint256 initialBalance = token.balanceOf(sender);
        
        vm.prank(sender);
        htlc.refund(contractId);
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        assertFalse(htlcContract.withdrawn);
        assertTrue(htlcContract.refunded);
        
        assertEq(token.balanceOf(sender), initialBalance + amount);
    }
    
    function testRefundETHAfterTimelock() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLCEth{value: 1 ether}(
            receiver,
            hashlock,
            timelock,
            nearAccount
        );
        
        // Move time forward past timelock
        vm.warp(timelock + 1);
        
        uint256 initialBalance = sender.balance;
        
        vm.prank(sender);
        htlc.refund(contractId);
        
        HTLCEthereum.HTLCContract memory htlcContract = htlc.getContract(contractId);
        assertFalse(htlcContract.withdrawn);
        assertTrue(htlcContract.refunded);
        
        assertEq(sender.balance, initialBalance + 1 ether);
    }
    
    function testFailRefundBeforeTimelock() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.prank(sender);
        htlc.refund(contractId);
    }
    
    function testFailRefundByWrongSender() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.warp(timelock + 1);
        
        vm.prank(receiver); // Wrong caller
        htlc.refund(contractId);
    }
    
    function testCheckPreimage() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        assertTrue(htlc.checkPreimage(contractId, secret));
        
        bytes32 wrongSecret = keccak256("wrong_secret");
        assertFalse(htlc.checkPreimage(contractId, wrongSecret));
    }
    
    function testFailCreateHTLCWithZeroAmount() public {
        vm.prank(sender);
        htlc.createHTLC(
            receiver,
            address(token),
            0, // Zero amount
            hashlock,
            timelock,
            nearAccount
        );
    }
    
    function testFailCreateHTLCWithPastTimelock() public {
        vm.prank(sender);
        htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            block.timestamp - 1, // Past timelock
            nearAccount
        );
    }
    
    function testFailDoubleWithdraw() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.prank(receiver);
        htlc.withdraw(contractId, secret);
        
        // Try to withdraw again
        vm.prank(receiver);
        htlc.withdraw(contractId, secret);
    }
    
    function testFailDoubleRefund() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.warp(timelock + 1);
        
        vm.prank(sender);
        htlc.refund(contractId);
        
        // Try to refund again
        vm.prank(sender);
        htlc.refund(contractId);
    }
    
    function testFailWithdrawAfterRefund() public {
        vm.prank(sender);
        bytes32 contractId = htlc.createHTLC(
            receiver,
            address(token),
            amount,
            hashlock,
            timelock,
            nearAccount
        );
        
        vm.warp(timelock + 1);
        
        vm.prank(sender);
        htlc.refund(contractId);
        
        // Try to withdraw after refund
        vm.prank(receiver);
        htlc.withdraw(contractId, secret);
    }
}