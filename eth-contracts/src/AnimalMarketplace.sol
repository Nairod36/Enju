// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../lib/openzeppelin-contracts/contracts/security/Pausable.sol";
import "../lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./EnuToken.sol";
import "./IslandAnimals.sol";

/**
 * @title AnimalMarketplace - NFT Marketplace for Enju Island Animals
 * @dev Marketplace for minting blockchain-specific animals and trading existing ones
 * @notice Users can mint ETH, NEAR, or TRON animals using ENU tokens and trade with others
 * 
 * Features:
 * - Blockchain-specific animal minting (ETH, NEAR, TRON)
 * - ENU token-only payments for fairness
 * - Secondary market for trading animals
 * - Special events with limited-time offers
 * - Referral system for community growth
 */
contract AnimalMarketplace is Ownable, Pausable, ReentrancyGuard {
    
    EnuToken public immutable enuToken;
    IslandAnimals public immutable islandAnimals;
    
    // Minting costs (in ENU tokens) for each blockchain type
    uint256 public ethAnimalCost = 100 * 10**18; // 100 ENU for ETH animals
    uint256 public nearAnimalCost = 150 * 10**18; // 150 ENU for NEAR animals  
    uint256 public tronAnimalCost = 200 * 10**18; // 200 ENU for TRON animals
    
    // Secondary market fee (2.5%)
    uint256 public constant MARKET_FEE = 250; // 2.5% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    
    // Referral system
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralEarnings;
    uint256 public constant REFERRAL_BONUS = 500; // 5% referral bonus
    
    // Active listings (ENU token only)
    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 priceENU;
        bool isActive;
        uint256 listedAt;
    }
    
    mapping(uint256 => Listing) public listings;
    uint256[] public activeListings;
    mapping(uint256 => uint256) private listingIndex; // tokenId => index in activeListings
    
    // Special events
    struct SpecialEvent {
        string name;
        uint256 startTime;
        uint256 endTime;
        uint256 discountPercent; // Discount on minting costs
        bool guaranteeShiny; // Guarantee shiny animals
        bool isActive;
    }
    
    mapping(uint256 => SpecialEvent) public specialEvents;
    uint256 public currentEventId;
    
    // Statistics
    uint256 public totalMints;
    uint256 public totalTrades;
    uint256 public totalVolumeENU;
    
    // Events
    event AnimalMinted(
        address indexed minter, 
        uint256 indexed tokenId, 
        string blockchainType,
        uint256 costENU,
        address referrer
    );
    
    event AnimalListed(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 priceENU
    );
    
    event AnimalSold(
        address indexed seller,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 priceENU,
        uint256 marketFee
    );
    
    event ListingCancelled(
        address indexed seller,
        uint256 indexed tokenId
    );
    
    event SpecialEventCreated(
        uint256 indexed eventId,
        string name,
        uint256 startTime,
        uint256 endTime
    );
    
    event ReferralRegistered(address indexed user, address indexed referrer);
    
    event MintingCostUpdated(string blockchainType, uint256 newCost);
    
    constructor(address _enuToken, address _islandAnimals) {
        require(_enuToken != address(0), "Marketplace: ENU token address cannot be zero");
        require(_islandAnimals != address(0), "Marketplace: IslandAnimals address cannot be zero");
        
        enuToken = EnuToken(_enuToken);
        islandAnimals = IslandAnimals(_islandAnimals);
    }
    
    /**
     * @dev Register a referrer for bonus rewards
     * @param referrer Address of the referrer
     */
    function registerReferrer(address referrer) external {
        require(referrer != address(0), "Marketplace: referrer cannot be zero address");
        require(referrer != msg.sender, "Marketplace: cannot refer yourself");
        require(referrers[msg.sender] == address(0), "Marketplace: referrer already set");
        
        referrers[msg.sender] = referrer;
        emit ReferralRegistered(msg.sender, referrer);
    }
    
    /**
     * @dev Mint an ETH blockchain animal using ENU tokens
     */
    function mintETHAnimal() external whenNotPaused nonReentrant {
        _mintBlockchainAnimal(msg.sender, IslandAnimals.BlockchainType.ETH, ethAnimalCost);
    }
    
    /**
     * @dev Mint a NEAR blockchain animal using ENU tokens
     */
    function mintNEARAnimal() external whenNotPaused nonReentrant {
        _mintBlockchainAnimal(msg.sender, IslandAnimals.BlockchainType.NEAR, nearAnimalCost);
    }
    
    /**
     * @dev Mint a TRON blockchain animal using ENU tokens
     */
    function mintTRONAnimal() external whenNotPaused nonReentrant {
        _mintBlockchainAnimal(msg.sender, IslandAnimals.BlockchainType.TRON, tronAnimalCost);
    }
    
    /**
     * @dev Internal function to handle blockchain animal minting
     */
    function _mintBlockchainAnimal(
        address minter,
        IslandAnimals.BlockchainType blockchainType,
        uint256 cost
    ) private {
        // Apply special event discount
        uint256 actualCost = _applyEventDiscount(cost);
        
        // Burn ENU tokens from minter
        enuToken.burnForUpgrade(minter, actualCost, "AnimalMinting");
        
        // Handle referral bonus
        address referrer = referrers[minter];
        if (referrer != address(0)) {
            uint256 referralBonus = (actualCost * REFERRAL_BONUS) / BASIS_POINTS;
            referralEarnings[referrer] += referralBonus;
            // Mint bonus tokens to referrer
            enuToken.mintSpecial(referrer, referralBonus, "ReferralBonus");
        }
        
        // Generate random seed
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            minter,
            totalMints,
            uint256(blockchainType)
        )));
        
        // Mint the animal
        uint256 tokenId = islandAnimals.mintBlockchainAnimal(minter, blockchainType, seed);
        
        // Update statistics
        totalMints++;
        totalVolumeENU += actualCost;
        
        string memory blockchainName;
        if (blockchainType == IslandAnimals.BlockchainType.ETH) blockchainName = "ETH";
        else if (blockchainType == IslandAnimals.BlockchainType.NEAR) blockchainName = "NEAR";
        else if (blockchainType == IslandAnimals.BlockchainType.TRON) blockchainName = "TRON";
        
        emit AnimalMinted(minter, tokenId, blockchainName, actualCost, referrer);
    }
    
    /**
     * @dev List an animal for sale on the marketplace (ENU tokens only)
     * @param tokenId Token ID to list
     * @param priceENU Price in ENU tokens
     */
    function listAnimal(
        uint256 tokenId,
        uint256 priceENU
    ) external whenNotPaused nonReentrant {
        require(islandAnimals.ownerOf(tokenId) == msg.sender, "Marketplace: not owner");
        require(priceENU > 0, "Marketplace: must set price");
        require(!listings[tokenId].isActive, "Marketplace: already listed");
        
        // Transfer NFT to marketplace for escrow
        islandAnimals.transferFrom(msg.sender, address(this), tokenId);
        
        // Create listing
        listings[tokenId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            priceENU: priceENU,
            isActive: true,
            listedAt: block.timestamp
        });
        
        // Add to active listings array
        listingIndex[tokenId] = activeListings.length;
        activeListings.push(tokenId);
        
        emit AnimalListed(msg.sender, tokenId, priceENU);
    }
    
    /**
     * @dev Buy an animal with ENU tokens
     * @param tokenId Token ID to buy
     */
    function buyAnimal(uint256 tokenId) external whenNotPaused nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Marketplace: listing not active");
        require(msg.sender != listing.seller, "Marketplace: cannot buy own listing");
        
        uint256 price = listing.priceENU;
        uint256 marketFee = (price * MARKET_FEE) / BASIS_POINTS;
        uint256 sellerAmount = price - marketFee;
        
        // Transfer payment
        enuToken.transferFrom(msg.sender, listing.seller, sellerAmount);
        enuToken.transferFrom(msg.sender, owner(), marketFee);
        
        // Transfer NFT to buyer
        islandAnimals.transferFrom(address(this), msg.sender, tokenId);
        
        // Update statistics
        totalTrades++;
        totalVolumeENU += price;
        
        emit AnimalSold(listing.seller, msg.sender, tokenId, price, marketFee);
        
        // Remove listing
        _removeListing(tokenId);
    }
        uint256 sellerAmount = price - marketFee;
        
        // Transfer payments
        payable(listing.seller).transfer(sellerAmount);
        payable(owner()).transfer(marketFee);
        
        // Refund excess ETH
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        // Transfer NFT to buyer
        islandAnimals.transferFrom(address(this), msg.sender, tokenId);
        
        // Update statistics
        totalTrades++;
        totalVolumeETH += price;
        
        emit AnimalSold(listing.seller, msg.sender, tokenId, 0, price, marketFee);
        
        // Remove listing
        _removeListing(tokenId);
    }
    
    /**
     * @dev Cancel a listing and return NFT to seller
     * @param tokenId Token ID to cancel
     */
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Marketplace: listing not active");
        require(msg.sender == listing.seller || msg.sender == owner(), "Marketplace: not authorized");
        
        // Return NFT to seller
        islandAnimals.transferFrom(address(this), listing.seller, tokenId);
        
        emit ListingCancelled(listing.seller, tokenId);
        
        // Remove listing
        _removeListing(tokenId);
    }
    
    /**
     * @dev Remove a listing from active listings
     */
    function _removeListing(uint256 tokenId) private {
        listings[tokenId].isActive = false;
        
        // Remove from activeListings array
        uint256 index = listingIndex[tokenId];
        uint256 lastIndex = activeListings.length - 1;
        
        if (index != lastIndex) {
            uint256 lastTokenId = activeListings[lastIndex];
            activeListings[index] = lastTokenId;
            listingIndex[lastTokenId] = index;
        }
        
        activeListings.pop();
        delete listingIndex[tokenId];
    }
    
    /**
     * @dev Create a special minting event
     */
    function createSpecialEvent(
        string calldata name,
        uint256 duration,
        uint256 discountPercent,
        bool guaranteeShiny
    ) external onlyOwner {
        require(discountPercent <= 50, "Marketplace: discount too high");
        
        currentEventId++;
        specialEvents[currentEventId] = SpecialEvent({
            name: name,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            discountPercent: discountPercent,
            guaranteeShiny: guaranteeShiny,
            isActive: true
        });
        
        emit SpecialEventCreated(currentEventId, name, block.timestamp, block.timestamp + duration);
    }
    
    /**
     * @dev Apply event discount to mint cost
     */
    function _applyEventDiscount(uint256 cost) private view returns (uint256) {
        if (currentEventId == 0) return cost;
        
        SpecialEvent storage event_ = specialEvents[currentEventId];
        if (!event_.isActive || block.timestamp > event_.endTime) {
            return cost;
        }
        
        uint256 discount = (cost * event_.discountPercent) / 100;
        return cost - discount;
    }
    
    /**
     * @dev Get all active listings
     */
    function getActiveListings() external view returns (uint256[] memory) {
        return activeListings;
    }
    
    /**
     * @dev Get current mint costs with any active discounts
     */
    function getCurrentMintCosts() external view returns (
        uint256 ethCost,
        uint256 nearCost,
        uint256 tronCost
    ) {
        ethCost = _applyEventDiscount(ethAnimalCost);
        nearCost = _applyEventDiscount(nearAnimalCost);
        tronCost = _applyEventDiscount(tronAnimalCost);
    }
    
    /**
     * @dev Update minting costs for blockchain animals (owner only)
     */
    function updateMintingCosts(
        uint256 _ethCost,
        uint256 _nearCost,
        uint256 _tronCost
    ) external onlyOwner {
        require(_ethCost > 0 && _nearCost > 0 && _tronCost > 0, "Marketplace: costs must be positive");
        
        ethAnimalCost = _ethCost;
        nearAnimalCost = _nearCost;
        tronAnimalCost = _tronCost;
        
        emit MintingCostUpdated("ETH", _ethCost);
        emit MintingCostUpdated("NEAR", _nearCost);
        emit MintingCostUpdated("TRON", _tronCost);
    }
    
    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency function to recover stuck NFTs
     */
    function emergencyRecoverNFT(uint256 tokenId) external onlyOwner {
        require(islandAnimals.ownerOf(tokenId) == address(this), "Marketplace: NFT not in contract");
        
        Listing storage listing = listings[tokenId];
        if (listing.isActive) {
            islandAnimals.transferFrom(address(this), listing.seller, tokenId);
            _removeListing(tokenId);
        } else {
            // If no active listing, transfer to owner
            islandAnimals.transferFrom(address(this), owner(), tokenId);
        }
    }
}
