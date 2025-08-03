// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AnimalNFT.sol";
import "./RewardToken.sol";

/**
 * @title AnimalMarketplace
 * @dev Marketplace pour l'achat et la vente d'animaux NFT
 * Permet aux joueurs d'échanger leurs animaux entre eux
 */
contract AnimalMarketplace is Ownable, ReentrancyGuard, IERC721Receiver {
    
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

    // Le contrat NFT d'animaux et RewardToken
    AnimalNFT public immutable animalNFT;
    RewardToken public immutable rewardToken;
    
    // Mappings pour les listings
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    
    // Pas de frais pour le marketplace interne - RewardTokens sans valeur monétaire
    
    // Événements
    event ItemListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event AuctionStarted(uint256 indexed tokenId, address indexed seller, uint256 startingPrice, uint256 duration);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 finalPrice);
    event AuctionCancelled(uint256 indexed tokenId, address indexed seller);

    constructor(address _animalNFT, address _rewardToken, address initialOwner) Ownable(initialOwner) {
        animalNFT = AnimalNFT(_animalNFT);
        rewardToken = RewardToken(_rewardToken);
    }

    /**
     * @dev Liste un animal NFT pour la vente
     */
    function listItem(uint256 tokenId, uint256 price) external {
        require(animalNFT.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        require(!listings[tokenId].active, "Item already listed");
        require(!auctions[tokenId].active, "Item is in auction");
        
        // Transférer le NFT au marketplace
        animalNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });
        
        emit ItemListed(tokenId, msg.sender, price);
    }

    /**
     * @dev Achète un animal NFT listé avec des RewardTokens
     */
    function buyItem(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Item not for sale");
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Transférer les RewardTokens de l'acheteur au vendeur (pas de frais)
        require(rewardToken.transferFrom(msg.sender, seller, price), "Token transfer failed");
        
        // Marquer comme inactif
        listing.active = false;
        
        // Transférer le NFT à l'acheteur
        animalNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        emit ItemSold(tokenId, seller, msg.sender, price);
    }

    /**
     * @dev Annule un listing
     */
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Item not listed");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;
        
        // Retourner le NFT au vendeur
        animalNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        emit ListingCancelled(tokenId, msg.sender);
    }

    /**
     * @dev Démarre une enchère pour un animal NFT
     */
    function startAuction(
        uint256 tokenId, 
        uint256 startingPrice, 
        uint256 duration,
        uint256 minBidIncrement
    ) external {
        require(animalNFT.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(startingPrice > 0, "Starting price must be greater than 0");
        require(duration >= 1 hours && duration <= 7 days, "Invalid duration");
        require(minBidIncrement > 0, "Min bid increment must be greater than 0");
        require(!listings[tokenId].active, "Item is listed for sale");
        require(!auctions[tokenId].active, "Auction already active");
        
        // Transférer le NFT au marketplace
        animalNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        
        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            currentBid: 0,
            currentBidder: address(0),
            endTime: block.timestamp + duration,
            active: true,
            minBidIncrement: minBidIncrement
        });
        
        emit AuctionStarted(tokenId, msg.sender, startingPrice, duration);
    }

    /**
     * @dev Place une enchère sur un animal NFT avec des RewardTokens
     */
    function placeBid(uint256 tokenId, uint256 bidAmount) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        
        uint256 minBid = auction.currentBid == 0 
            ? auction.startingPrice 
            : auction.currentBid + auction.minBidIncrement;
            
        require(bidAmount >= minBid, "Bid too low");
        
        // Transférer les tokens de l'enchérisseur au contrat
        require(rewardToken.transferFrom(msg.sender, address(this), bidAmount), "Token transfer failed");
        
        // Rembourser l'enchérisseur précédent s'il y en a un
        if (auction.currentBidder != address(0)) {
            require(rewardToken.transfer(auction.currentBidder, auction.currentBid), "Refund failed");
        }
        
        auction.currentBid = bidAmount;
        auction.currentBidder = msg.sender;
        
        emit BidPlaced(tokenId, msg.sender, bidAmount);
    }

    /**
     * @dev Termine une enchère
     */
    function endAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction still active");
        
        auction.active = false;
        
        if (auction.currentBidder != address(0)) {
            // Il y a un enchérisseur gagnant
            // Pas de frais - transfert direct des RewardTokens au vendeur
            require(rewardToken.transfer(auction.seller, auction.currentBid), "Payment to seller failed");
            
            // Transférer le NFT au gagnant
            animalNFT.safeTransferFrom(address(this), auction.currentBidder, tokenId);
            
            emit AuctionEnded(tokenId, auction.currentBidder, auction.currentBid);
        } else {
            // Aucune enchère, retourner le NFT au vendeur
            animalNFT.safeTransferFrom(address(this), auction.seller, tokenId);
            emit AuctionCancelled(tokenId, auction.seller);
        }
    }

    /**
     * @dev Annule une enchère (seulement si aucune enchère n'a été placée)
     */
    function cancelAuction(uint256 tokenId) external {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(auction.seller == msg.sender, "Not the seller");
        require(auction.currentBidder == address(0), "Cannot cancel with active bids");
        
        auction.active = false;
        
        // Retourner le NFT au vendeur
        animalNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        emit AuctionCancelled(tokenId, msg.sender);
    }


    /**
     * @dev Retourne tous les listings actifs
     */
    function getActiveListings() external view returns (uint256[] memory tokenIds, Listing[] memory activeListings) {
        // Cette fonction peut être optimisée avec un système d'index pour de meilleures performances
        uint256 totalSupply = animalNFT.totalSupply();
        uint256 activeCount = 0;
        
        // Premier passage pour compter les listings actifs
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (listings[i].active) {
                activeCount++;
            }
        }
        
        // Allouer les tableaux
        tokenIds = new uint256[](activeCount);
        activeListings = new Listing[](activeCount);
        
        // Deuxième passage pour remplir les tableaux
        uint256 index = 0;
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (listings[i].active) {
                tokenIds[index] = i;
                activeListings[index] = listings[i];
                index++;
            }
        }
    }

    /**
     * @dev Retourne toutes les enchères actives
     */
    function getActiveAuctions() external view returns (uint256[] memory tokenIds, Auction[] memory activeAuctions) {
        uint256 totalSupply = animalNFT.totalSupply();
        uint256 activeCount = 0;
        
        // Premier passage pour compter les enchères actives
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (auctions[i].active) {
                activeCount++;
            }
        }
        
        // Allouer les tableaux
        tokenIds = new uint256[](activeCount);
        activeAuctions = new Auction[](activeCount);
        
        // Deuxième passage pour remplir les tableaux
        uint256 index = 0;
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (auctions[i].active) {
                tokenIds[index] = i;
                activeAuctions[index] = auctions[i];
                index++;
            }
        }
    }


    /**
     * @dev Fonction de secours pour les NFT bloqués (seulement le propriétaire)
     */
    function emergencyWithdrawNFT(uint256 tokenId) external onlyOwner {
        require(
            !listings[tokenId].active && !auctions[tokenId].active,
            "Cannot withdraw active listing/auction"
        );
        animalNFT.safeTransferFrom(address(this), owner(), tokenId);
    }

    /**
     * @dev Implémentation IERC721Receiver pour recevoir des NFT
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}