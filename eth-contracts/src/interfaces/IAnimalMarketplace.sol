// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAnimalMarketplace
 * @dev Interface pour le contrat AnimalMarketplace
 */
interface IAnimalMarketplace {
    
    struct Listing {
        address seller;
        uint256 price;
        bool active;
        uint256 listedAt;
    }

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 currentBid;
        address currentBidder;
        uint256 endTime;
        bool active;
        uint256 minBidIncrement;
    }

    // Events
    event ItemListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event AuctionStarted(uint256 indexed tokenId, address indexed seller, uint256 startingPrice, uint256 duration);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 finalPrice);
    event AuctionCancelled(uint256 indexed tokenId, address indexed seller);

    // Listing functions
    function listItem(uint256 tokenId, uint256 price) external;
    function buyItem(uint256 tokenId) external;
    function cancelListing(uint256 tokenId) external;

    // Auction functions
    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 duration, uint256 minBidIncrement) external;
    function placeBid(uint256 tokenId, uint256 bidAmount) external;
    function endAuction(uint256 tokenId) external;
    function cancelAuction(uint256 tokenId) external;

    // View functions
    function listings(uint256 tokenId) external view returns (Listing memory);
    function auctions(uint256 tokenId) external view returns (Auction memory);
    function getActiveListings() external view returns (uint256[] memory tokenIds, Listing[] memory activeListings);
    function getActiveAuctions() external view returns (uint256[] memory tokenIds, Auction[] memory activeAuctions);

    // Admin functions
    function emergencyWithdrawNFT(uint256 tokenId) external;
}