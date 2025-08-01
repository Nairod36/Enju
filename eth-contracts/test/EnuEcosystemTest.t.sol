// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Test.sol";
import "../src/EnuToken.sol";
import "../src/IslandAnimals.sol";
import "../src/AnimalMarketplace.sol";

/**
 * @title EnuEcosystemTest - Comprehensive test suite for Enju ecosystem
 * @dev Tests token minting, NFT creation, marketplace functionality
 */
contract EnuEcosystemTest is Test {
    EnuToken public enuToken;
    IslandAnimals public islandAnimals;
    AnimalMarketplace public marketplace;
    
    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public crossChainResolver = address(0x3);
    
    function setUp() public {
        // Deploy contracts
        enuToken = new EnuToken();
        islandAnimals = new IslandAnimals();
        marketplace = new AnimalMarketplace(address(enuToken), address(islandAnimals));
        
        // Setup permissions
        enuToken.authorizeMinter(crossChainResolver);
        enuToken.authorizeBurner(address(marketplace));
        islandAnimals.authorizeMinter(address(marketplace));
        
        // Give users some ETH for testing
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }
    
    function test_TokenDeployment() public {
        assertEq(enuToken.name(), "Enju Token");
        assertEq(enuToken.symbol(), "ENU");
        assertEq(enuToken.decimals(), 18);
        assertEq(enuToken.totalSupply(), 1000000 * 10**18); // Initial supply
    }
    
    function test_NFTDeployment() public {
        assertEq(islandAnimals.name(), "Island Animals");
        assertEq(islandAnimals.symbol(), "ANIENU");
        assertEq(islandAnimals.totalMinted(), 0);
    }
    
    function test_TokenMintingFromCrossChain() public {
        uint256 swapAmount = 1 ether;
        
        // Simulate cross-chain swap completion
        vm.prank(crossChainResolver);
        enuToken.mintSwapReward(user1, swapAmount, true); // Cross-chain bridge
        
        // Check user received 2.5% of swap amount as tokens
        uint256 expectedReward = (swapAmount * 250) / 10000; // 2.5%
        assertEq(enuToken.balanceOf(user1), expectedReward);
    }
    
    function test_RegularSwapReward() public {
        uint256 swapAmount = 1 ether;
        
        // Simulate regular swap
        vm.prank(crossChainResolver);
        enuToken.mintSwapReward(user1, swapAmount, false); // Regular swap
        
        // Check user received 0.1% of swap amount as tokens
        uint256 expectedReward = (swapAmount * 10) / 10000; // 0.1%
        assertEq(enuToken.balanceOf(user1), expectedReward);
    }
    
    function test_NFTMintingBasic() public {
        // Give user1 some ENU tokens
        vm.prank(crossChainResolver);
        enuToken.mintSwapReward(user1, 10 ether, true); // Mint enough tokens
        
        uint256 userBalance = enuToken.balanceOf(user1);
        assertTrue(userBalance >= marketplace.BASIC_MINT_COST());
        
        // Approve marketplace to spend tokens
        vm.prank(user1);
        enuToken.approve(address(marketplace), marketplace.BASIC_MINT_COST());
        
        // Mint basic animal
        vm.prank(user1);
        marketplace.mintBasicAnimal();
        
        // Check NFT was minted
        assertEq(islandAnimals.totalMinted(), 1);
        assertEq(islandAnimals.ownerOf(0), user1);
        
        // Check tokens were burned
        uint256 newBalance = enuToken.balanceOf(user1);
        assertEq(newBalance, userBalance - marketplace.BASIC_MINT_COST());
    }
    
    function test_NFTMintingWithETH() public {
        uint256 initialBalance = user1.balance;
        
        // Mint animal with ETH
        vm.prank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        
        // Check NFT was minted
        assertEq(islandAnimals.totalMinted(), 1);
        assertEq(islandAnimals.ownerOf(0), user1);
        
        // Check ETH was spent
        assertEq(user1.balance, initialBalance - marketplace.basicMintCostETH());
    }
    
    function test_NFTTraits() public {
        // Mint an animal
        vm.prank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        
        // Check traits are set
        IslandAnimals.AnimalTraits memory traits = islandAnimals.getAnimalTraits(0);
        assertTrue(traits.strength >= 40 && traits.strength <= 100);
        assertTrue(traits.agility >= 40 && traits.agility <= 100);
        assertTrue(traits.magic >= 40 && traits.magic <= 100);
        assertTrue(bytes(traits.species).length > 0);
        assertTrue(bytes(traits.color).length > 0);
    }
    
    function test_MarketplaceListing() public {
        // Mint an animal for user1
        vm.prank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        
        uint256 tokenId = 0;
        uint256 priceENU = 1000 * 10**18; // 1000 ENU
        uint256 priceETH = 0.1 ether;
        
        // Approve marketplace to transfer NFT
        vm.prank(user1);
        islandAnimals.approve(address(marketplace), tokenId);
        
        // List the animal
        vm.prank(user1);
        marketplace.listAnimal(tokenId, priceENU, priceETH);
        
        // Check listing was created
        (
            address seller,
            uint256 listedTokenId,
            uint256 listedPriceENU,
            uint256 listedPriceETH,
            bool isActive,
            
        ) = marketplace.listings(tokenId);
        
        assertEq(seller, user1);
        assertEq(listedTokenId, tokenId);
        assertEq(listedPriceENU, priceENU);
        assertEq(listedPriceETH, priceETH);
        assertTrue(isActive);
        
        // Check NFT is now owned by marketplace
        assertEq(islandAnimals.ownerOf(tokenId), address(marketplace));
    }
    
    function test_MarketplacePurchaseWithETH() public {
        // Setup: user1 mints and lists an animal
        vm.prank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        
        vm.prank(user1);
        islandAnimals.approve(address(marketplace), 0);
        
        uint256 priceETH = 0.1 ether;
        vm.prank(user1);
        marketplace.listAnimal(0, 0, priceETH); // ETH only
        
        // user2 buys the animal
        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;
        
        vm.prank(user2);
        marketplace.buyAnimalWithETH{value: priceETH}(0);
        
        // Check ownership transferred
        assertEq(islandAnimals.ownerOf(0), user2);
        
        // Check payments (minus marketplace fee)
        uint256 marketFee = (priceETH * marketplace.MARKET_FEE()) / marketplace.BASIS_POINTS();
        uint256 sellerAmount = priceETH - marketFee;
        
        assertEq(user1.balance, user1BalanceBefore + sellerAmount);
        assertEq(user2.balance, user2BalanceBefore - priceETH);
    }
    
    function test_ReferralSystem() public {
        // user2 refers user1
        vm.prank(user1);
        marketplace.registerReferrer(user2);
        
        // Give user1 tokens and mint animal
        vm.prank(crossChainResolver);
        enuToken.mintSwapReward(user1, 10 ether, true);
        
        uint256 referrerBalanceBefore = enuToken.balanceOf(user2);
        
        vm.prank(user1);
        enuToken.approve(address(marketplace), marketplace.BASIC_MINT_COST());
        
        vm.prank(user1);
        marketplace.mintBasicAnimal();
        
        // Check referrer received bonus
        uint256 expectedBonus = (marketplace.BASIC_MINT_COST() * marketplace.REFERRAL_BONUS()) / marketplace.BASIS_POINTS();
        assertEq(enuToken.balanceOf(user2), referrerBalanceBefore + expectedBonus);
    }
    
    function test_UnauthorizedMinting() public {
        // Try to mint tokens from unauthorized address
        vm.expectRevert("EnuToken: caller is not authorized minter");
        vm.prank(user1);
        enuToken.mintSwapReward(user1, 1 ether, false);
        
        // Try to mint NFT from unauthorized address
        vm.expectRevert("IslandAnimals: caller is not authorized minter");
        vm.prank(user1);
        islandAnimals.mintRandomAnimal(user1, 12345);
    }
    
    function test_TokenBurning() public {
        // Mint tokens first
        vm.prank(crossChainResolver);
        enuToken.mintSwapReward(user1, 10 ether, true);
        
        uint256 balanceBefore = enuToken.balanceOf(user1);
        uint256 burnAmount = 100 * 10**18;
        
        // Burn tokens from marketplace
        vm.prank(address(marketplace));
        enuToken.burnForUpgrade(user1, burnAmount, "TestBurn");
        
        assertEq(enuToken.balanceOf(user1), balanceBefore - burnAmount);
        assertEq(enuToken.totalBurned(), burnAmount);
    }
    
    function test_RewardCalculation() public {
        uint256 swapAmount = 1 ether;
        
        // Test regular swap reward calculation
        uint256 regularReward = enuToken.calculateReward(swapAmount, false);
        assertEq(regularReward, (swapAmount * 10) / 10000); // 0.1%
        
        // Test cross-chain reward calculation
        uint256 bridgeReward = enuToken.calculateReward(swapAmount, true);
        assertEq(bridgeReward, (swapAmount * 250) / 10000); // 2.5%
    }
    
    function test_NFTMetadata() public {
        // Mint an animal
        vm.prank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        
        // Check metadata is generated
        string memory tokenURI = islandAnimals.tokenURI(0);
        assertTrue(bytes(tokenURI).length > 0);
        
        // Should be base64 encoded JSON
        assertTrue(bytes(tokenURI).length > 29); // "data:application/json;base64," = 29 chars
    }
    
    function test_GetUserAnimals() public {
        // Mint multiple animals for user1
        vm.startPrank(user1);
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        marketplace.mintBasicAnimalETH{value: marketplace.basicMintCostETH()}();
        vm.stopPrank();
        
        // Check user owns all 3 animals
        uint256[] memory userAnimals = islandAnimals.getAnimalsByOwner(user1);
        assertEq(userAnimals.length, 3);
        assertEq(userAnimals[0], 0);
        assertEq(userAnimals[1], 1);
        assertEq(userAnimals[2], 2);
    }
}
