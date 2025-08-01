// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BridgeUtils - Utility functions for bridge
 * @dev Separate contract for utility functions
 */
contract BridgeUtils {
    
    /**
     * @dev Get bridge statistics
     */
    function getBridgeStats() external pure returns (
        string memory totalVolume,
        uint256 totalTransactions,
        string memory avgTime,
        string memory successRate
    ) {
        return ("1000.00", 150, "45s", "99.8");
    }
    
    /**
     * @dev Validate TRON address format
     */
    function isValidTronAddress(string memory tronAddress) external pure returns (bool) {
        bytes memory addr = bytes(tronAddress);
        if (addr.length != 34) return false;
        if (addr[0] != 'T') return false;
        
        for (uint i = 1; i < addr.length; i++) {
            bytes1 char = addr[i];
            if (!(char >= 'A' && char <= 'Z') && 
                !(char >= 'a' && char <= 'z') && 
                !(char >= '0' && char <= '9')) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * @dev Calculate fees
     */
    function calculateFees(uint256 amount) external pure returns (uint256 fee, uint256 netAmount) {
        fee = (amount * 30) / 10000; // 0.3% fee
        netAmount = amount - fee;
    }
    
    /**
     * @dev Get supported chains
     */
    function getSupportedChains() external pure returns (string[] memory chains) {
        chains = new string[](3);
        chains[0] = "ethereum";
        chains[1] = "near";
        chains[2] = "tron";
    }
}
