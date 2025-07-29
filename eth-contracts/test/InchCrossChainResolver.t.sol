// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/InchCrossChainResolver.sol";
import "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("MockToken", "MTK") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract InchCrossChainResolverTest is Test {
    InchCrossChainResolver public resolver;
    MockERC20 public token;
    
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    bytes32 public secret = keccak256("test_secret");
    bytes32 public hashlock = sha256(abi.encodePacked(secret));
    
    string public nearAccount = "user.near";
    
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
    
    function setUp() public {
        resolver = new InchCrossChainResolver();
        token = new MockERC20();
        
        // Setup test accounts with ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        
        // Mint tokens for testing
        token.mint(user1, 1000 ether);
        token.mint(user2, 1000 ether);
    }
    
    function testDeployment() public {
        assertEq(resolver.owner(), address(this));
        assertTrue(resolver.authorizedResolvers(address(this)));
        assertEq(address(resolver.ESCROW_FACTORY()), 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a);
    }
    
    function testAuthorizeResolver() public {
        address newResolver = address(0x123);
        
        // Initially not authorized
        assertFalse(resolver.authorizedResolvers(newResolver));
        
        // Authorize resolver
        resolver.authorizeResolver(newResolver);
        
        // Now authorized
        assertTrue(resolver.authorizedResolvers(newResolver));
    }
    
    function testFailUnauthorizedResolverAuthorization() public {
        vm.prank(user1);
        resolver.authorizeResolver(address(0x123));
    }
    
    function testRegisterNEARSwap() public {
        string memory nearTxHash = "0x1234567890abcdef";
        address ethRecipient = user1;
        
        vm.expectEmit(true, true, false, true);
        emit NEARSwapCreated(nearTxHash, hashlock, ethRecipient);
        
        resolver.registerNEARSwap(nearTxHash, hashlock, ethRecipient);
    }
    
    function testFailUnauthorizedNEARSwapRegistration() public {
        vm.prank(user1);
        resolver.registerNEARSwap("0x123", hashlock, user2);
    }
    
    function testEmergencyWithdraw() public {
        // Send some ETH to the contract
        vm.deal(address(resolver), 1 ether);
        
        uint256 ownerBalanceBefore = address(this).balance;
        
        resolver.emergencyWithdraw();
        
        assertEq(address(this).balance, ownerBalanceBefore + 1 ether);
        assertEq(address(resolver).balance, 0);
    }
    
    function testFailUnauthorizedEmergencyWithdraw() public {
        vm.prank(user1);
        resolver.emergencyWithdraw();
    }
    
    function testDeauthorizeResolver() public {
        address resolverToDeauth = address(0x123);
        
        // First authorize
        resolver.authorizeResolver(resolverToDeauth);
        assertTrue(resolver.authorizedResolvers(resolverToDeauth));
        
        // Then deauthorize
        resolver.deauthorizeResolver(resolverToDeauth);
        assertFalse(resolver.authorizedResolvers(resolverToDeauth));
    }
    
    function testSwapStructure() public {
        // Test the CrossChainSwap struct getter
        bytes32 swapId = keccak256("test");
        
        InchCrossChainResolver.CrossChainSwap memory swap = resolver.getSwap(swapId);
        
        // Should return empty struct for non-existent swap
        assertEq(swap.escrowSrc, address(0));
        assertEq(swap.secretHash, bytes32(0));
        assertEq(swap.amount, 0);
        assertFalse(swap.completed);
    }
    
    // Receive ETH for testing
    receive() external payable {}
}