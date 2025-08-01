// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../lib/openzeppelin-contracts/contracts/security/Pausable.sol";
import "../lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnuToken (ENU) - Enju Platform Utility Token
 * @dev ERC20 token that can only be minted by authorized contracts (CrossChainResolver)
 * @notice Users earn ENU tokens by performing swaps and cross-chain bridges
 * 
 * Token Economics:
 * - Total Supply: Unlimited (but controlled by mint rates)
 * - Decimals: 18
 * - Mint Rate: 0.1% of swap amount for regular swaps, 2.5% for cross-chain bridges
 * - Burn: Tokens burned when spent on island upgrades
 */
contract EnuToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    
    // Mapping of authorized minters (CrossChainResolver, other bridges)
    mapping(address => bool) public authorizedMinters;
    
    // Mapping of authorized burners (Marketplace, Island upgrade contracts)
    mapping(address => bool) public authorizedBurners;
    
    // Tracking total minted tokens for analytics
    uint256 public totalMinted;
    uint256 public totalBurned;
    
    // Mint rate configurations (basis points, where 10000 = 100%)
    uint256 public constant SWAP_MINT_RATE = 10; // 0.1%
    uint256 public constant BRIDGE_MINT_RATE = 250; // 2.5%
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event MinterAuthorized(address indexed minter);
    event MinterDeauthorized(address indexed minter);
    event BurnerAuthorized(address indexed burner);
    event BurnerDeauthorized(address indexed burner);
    event TokensMinted(address indexed to, uint256 amount, string mintType);
    event TokensBurned(address indexed from, uint256 amount, string burnReason);
    
    constructor() ERC20("Enju Token", "ENU") {
        // Initial supply goes to owner for initial liquidity/testing
        _mint(msg.sender, 1000000 * 10**decimals()); // 1M tokens for initialization
    }
    
    /**
     * @dev Modifier to check if caller is authorized minter
     */
    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "EnuToken: caller is not authorized minter");
        _;
    }
    
    /**
     * @dev Modifier to check if caller is authorized burner
     */
    modifier onlyBurner() {
        require(authorizedBurners[msg.sender], "EnuToken: caller is not authorized burner");
        _;
    }
    
    /**
     * @dev Authorize an address to mint tokens (CrossChainResolver, bridges)
     * @param minter Address to authorize
     */
    function authorizeMinter(address minter) external onlyOwner {
        require(minter != address(0), "EnuToken: minter cannot be zero address");
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    /**
     * @dev Deauthorize a minter
     * @param minter Address to deauthorize
     */
    function deauthorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterDeauthorized(minter);
    }
    
    /**
     * @dev Authorize an address to burn tokens (Marketplace, upgrade contracts)
     * @param burner Address to authorize
     */
    function authorizeBurner(address burner) external onlyOwner {
        require(burner != address(0), "EnuToken: burner cannot be zero address");
        authorizedBurners[burner] = true;
        emit BurnerAuthorized(burner);
    }
    
    /**
     * @dev Deauthorize a burner
     * @param burner Address to deauthorize
     */
    function deauthorizeBurner(address burner) external onlyOwner {
        authorizedBurners[burner] = false;
        emit BurnerDeauthorized(burner);
    }
    
    /**
     * @dev Mint tokens for swap rewards - only callable by authorized minters
     * @param to Recipient address
     * @param swapAmount Original swap amount in wei
     * @param isCrossChain Whether this is a cross-chain swap (higher rewards)
     */
    function mintSwapReward(
        address to, 
        uint256 swapAmount, 
        bool isCrossChain
    ) external onlyMinter whenNotPaused nonReentrant {
        require(to != address(0), "EnuToken: mint to zero address");
        require(swapAmount > 0, "EnuToken: swap amount must be positive");
        
        uint256 mintRate = isCrossChain ? BRIDGE_MINT_RATE : SWAP_MINT_RATE;
        uint256 rewardAmount = (swapAmount * mintRate) / BASIS_POINTS;
        
        // Minimum reward of 1 token to prevent zero rewards on small swaps
        if (rewardAmount == 0) {
            rewardAmount = 1 * 10**decimals();
        }
        
        _mint(to, rewardAmount);
        totalMinted += rewardAmount;
        
        string memory mintType = isCrossChain ? "CrossChainBridge" : "RegularSwap";
        emit TokensMinted(to, rewardAmount, mintType);
    }
    
    /**
     * @dev Mint specific amount (for special events, airdrops)
     * @param to Recipient address
     * @param amount Amount to mint
     * @param mintType Description of mint reason
     */
    function mintSpecial(
        address to,
        uint256 amount,
        string calldata mintType
    ) external onlyOwner whenNotPaused nonReentrant {
        require(to != address(0), "EnuToken: mint to zero address");
        require(amount > 0, "EnuToken: amount must be positive");
        
        _mint(to, amount);
        totalMinted += amount;
        emit TokensMinted(to, amount, mintType);
    }
    
    /**
     * @dev Burn tokens when spent on island upgrades or marketplace
     * @param from Address to burn from
     * @param amount Amount to burn
     * @param reason Reason for burning
     */
    function burnForUpgrade(
        address from,
        uint256 amount,
        string calldata reason
    ) external onlyBurner whenNotPaused nonReentrant {
        require(from != address(0), "EnuToken: burn from zero address");
        require(amount > 0, "EnuToken: amount must be positive");
        require(balanceOf(from) >= amount, "EnuToken: insufficient balance");
        
        _burn(from, amount);
        totalBurned += amount;
        emit TokensBurned(from, amount, reason);
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
     * @dev Get circulating supply (total supply minus burned)
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }
    
    /**
     * @dev Get net minted amount (minted minus burned)
     */
    function netMinted() external view returns (uint256) {
        return totalMinted - totalBurned;
    }
    
    /**
     * @dev Calculate reward amount for a swap
     * @param swapAmount Swap amount in wei
     * @param isCrossChain Whether it's cross-chain
     * @return reward amount in tokens
     */
    function calculateReward(uint256 swapAmount, bool isCrossChain) 
        external 
        pure 
        returns (uint256) 
    {
        if (swapAmount == 0) return 0;
        
        uint256 mintRate = isCrossChain ? BRIDGE_MINT_RATE : SWAP_MINT_RATE;
        uint256 rewardAmount = (swapAmount * mintRate) / BASIS_POINTS;
        
        // Minimum reward of 1 token
        return rewardAmount == 0 ? 1 * 10**18 : rewardAmount;
    }
    
    /**
     * @dev Override transfer to add pause functionality
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom to add pause functionality
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }
}
