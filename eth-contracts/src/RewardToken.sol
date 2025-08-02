// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardToken is ERC20, Ownable {
    // Mapping pour les adresses autorisées à minter (bridge contracts)
    mapping(address => bool) public minters;
    
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        // Mint initial supply pour le owner (100M tokens)
        _mint(initialOwner, 100_000_000 * 10**decimals());
    }

    /**
     * @dev Ajouter une adresse autorisée à minter
     */
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }

    /**
     * @dev Retirer une adresse autorisée à minter
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }

    /**
     * @dev Mint des tokens de récompense (seulement par les minters autorisés)
     */
    function mintReward(address to, uint256 amount) external {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _mint(to, amount);
    }

    /**
     * @dev Burn des tokens (fonction utile pour la déflation)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burn des tokens d'une autre adresse (avec allowance)
     */
    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
}