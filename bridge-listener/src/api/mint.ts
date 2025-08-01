import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router: Router = Router();

// Configuration pour le mint (développement uniquement)
const MINT_CONFIG = {
    // Clé privée du compte admin avec beaucoup d'ETH (Anvil default account)
    adminPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    rpcUrl: process.env.ETH_RPC_URL || 'http://localhost:8545',
    contractAddress: process.env.ETH_BRIDGE_CONTRACT,
    // Montant par défaut à mint (en ETH)
    defaultMintAmount: '10.0'
};

/**
 * Mint ETH to a user address
 * POST /api/mint/eth
 * Body: { address: "0x...", amount?: "1.0" }
 */
router.post('/eth', async (req, res) => {
    try {
        const { address, amount } = req.body;

        if (!address || !ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Valid Ethereum address required' });
        }

        const mintAmount = amount || MINT_CONFIG.defaultMintAmount;
        const amountWei = ethers.parseEther(mintAmount);

        console.log(`🎁 Minting ${mintAmount} ETH to ${address}...`);

        // Connect to provider with admin wallet
        const provider = new ethers.JsonRpcProvider(MINT_CONFIG.rpcUrl);
        const adminWallet = new ethers.Wallet(MINT_CONFIG.adminPrivateKey, provider);

        // Check admin balance
        const adminBalance = await provider.getBalance(adminWallet.address);
        if (adminBalance < amountWei) {
            return res.status(400).json({
                error: 'Insufficient admin balance',
                adminBalance: ethers.formatEther(adminBalance),
                requested: mintAmount
            });
        }

        // Send ETH directly from admin to user
        const tx = await adminWallet.sendTransaction({
            to: address,
            value: amountWei,
            gasLimit: 21000
        });

        console.log(`📋 Mint transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();

        if (!receipt) {
            throw new Error('Transaction receipt is null');
        }

        console.log(`✅ ETH minted successfully!`);
        console.log(`💰 Sent ${mintAmount} ETH to ${address}`);

        // Get user's new balance
        const newBalance = await provider.getBalance(address);

        res.json({
            success: true,
            message: `Successfully minted ${mintAmount} ETH`,
            txHash: tx.hash,
            recipient: address,
            amount: mintAmount,
            newBalance: ethers.formatEther(newBalance),
            blockNumber: receipt.blockNumber
        });

    } catch (error) {
        console.error('❌ Error minting ETH:', error);
        res.status(500).json({
            error: 'Failed to mint ETH',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get user's ETH balance
 * GET /api/mint/balance/:address
 */
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }

        const provider = new ethers.JsonRpcProvider(MINT_CONFIG.rpcUrl);
        const balance = await provider.getBalance(address);

        res.json({
            address,
            balance: ethers.formatEther(balance),
            balanceWei: balance.toString()
        });

    } catch (error) {
        console.error('❌ Error getting balance:', error);
        res.status(500).json({
            error: 'Failed to get balance',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get network info
 * GET /api/mint/network
 */
router.get('/network', async (req, res) => {
    try {
        const provider = new ethers.JsonRpcProvider(MINT_CONFIG.rpcUrl);
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();

        // Check if it's a local fork
        const isLocalFork = MINT_CONFIG.rpcUrl.includes('localhost') ||
            MINT_CONFIG.rpcUrl.includes('127.0.0.1') ||
            network.chainId === 31337n; // Hardhat default

        res.json({
            chainId: network.chainId.toString(),
            name: network.name,
            rpcUrl: MINT_CONFIG.rpcUrl,
            blockNumber,
            isLocalFork,
            explorerNote: isLocalFork
                ? 'Local fork - transactions not visible on public explorers'
                : 'Transactions visible on block explorer'
        });

    } catch (error) {
        console.error('❌ Error getting network info:', error);
        res.status(500).json({
            error: 'Failed to get network info',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
