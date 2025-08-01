#!/usr/bin/env node

/**
 * Debug script for bridge transaction failure
 */

const { ethers } = require('ethers');

async function debugBridgeTransaction() {
    console.log('🔍 Debugging Bridge Transaction Failure');
    console.log('=====================================');

    // Configuration from environment
    const rpcUrl = process.env.ETH_RPC_URL || 'http://vps-b11044fd.vps.ovh.net/rpc';
    const contractAddress = process.env.ETH_BRIDGE_CONTRACT || '0xAE2c8c3bBDC09116bE01064009f13fCc272b0944';
    const privateKey = process.env.ETH_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📊 Configuration:');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Wallet: ${wallet.address}`);
    console.log('');

    // Contract ABI for CrossChainResolver
    const contractABI = [
        'function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (address escrow)',
        'function owner() external view returns (address)',
        'function swaps(bytes32) external view returns (address, address, address, uint256, uint256, uint256, bytes32, uint8, string, bool, uint256, uint256)'
    ];

    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Test parameters from the failed transaction
    const hashlock = '0x54622a51db8b6249041fca7aff1fb7e2bb3cab8b330889509a864f405f7cf864';
    const tronAddress = 'TA56h2z2HLeisU4d8NvBvidA9MYFBbV966N';
    const value = ethers.parseEther('0.01'); // 0.01 ETH

    console.log('📊 Transaction Parameters:');
    console.log(`   Hashlock: ${hashlock}`);
    console.log(`   TRON Address: ${tronAddress}`);
    console.log(`   Value: ${ethers.formatEther(value)} ETH`);
    console.log('');

    try {
        // 1. Check if contract exists
        console.log('1️⃣ Checking contract existence...');
        const code = await provider.getCode(contractAddress);
        if (code === '0x') {
            console.log('❌ Contract does not exist at this address!');
            return;
        }
        console.log('✅ Contract exists');
        console.log(`   Code size: ${code.length} bytes`);

        // 2. Check current account balance
        console.log('2️⃣ Checking account balance...');
        const balance = await provider.getBalance(wallet.address);
        console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
        if (balance < value) {
            console.log('❌ Insufficient balance for transaction!');
            return;
        }
        console.log('✅ Sufficient balance');

        // 3. Validate TRON address manually
        console.log('3️⃣ Validating TRON address...');
        console.log(`   Address: ${tronAddress}`);
        console.log(`   Length: ${tronAddress.length} (should be 34)`);
        console.log(`   Starts with T: ${tronAddress.startsWith('T')}`);
        
        // Check for forbidden Base58 characters
        const forbidden = ['0', 'O', 'I', 'l'];
        let hasForbiddenChar = false;
        for (let i = 1; i < tronAddress.length; i++) {
            const char = tronAddress[i];
            if (forbidden.includes(char)) {
                console.log(`   ❌ Forbidden character '${char}' at position ${i}`);
                hasForbiddenChar = true;
            }
        }
        if (!hasForbiddenChar) {
            console.log('   ✅ No forbidden characters found');
        }

        // 4. Try static call first to see if it would work without gas
        console.log('4️⃣ Testing static call...');
        try {
            const result = await contract.createETHToTRONBridge.staticCall(hashlock, tronAddress, { value });
            console.log('✅ Static call succeeded');
            console.log(`   Would create escrow at: ${result}`);
        } catch (staticError) {
            console.log('❌ Static call failed:');
            console.log(`   Error: ${staticError.reason || staticError.message}`);
            
            // Try to decode specific error messages
            if (staticError.reason) {
                switch (staticError.reason) {
                    case 'Amount must be greater than 0':
                        console.log('💡 Issue: Zero amount sent');
                        break;
                    case 'Invalid hashlock':
                        console.log('💡 Issue: Hashlock is zero or invalid');
                        break;
                    case 'TRON address required':
                        console.log('💡 Issue: Empty TRON address');
                        break;
                    case 'Invalid TRON address format':
                        console.log('💡 Issue: TRON address failed validation');
                        break;
                    default:
                        console.log('💡 Issue: Unknown validation failure');
                }
            }
            return;
        }

        // 5. Estimate gas
        console.log('5️⃣ Estimating gas...');
        try {
            const gasEstimate = await contract.createETHToTRONBridge.estimateGas(hashlock, tronAddress, { value });
            console.log(`   Estimated gas: ${gasEstimate.toString()}`);
        } catch (gasError) {
            console.log('❌ Gas estimation failed:');
            console.log(`   Error: ${gasError.reason || gasError.message}`);
            return;
        }

        // 6. Get current gas price
        console.log('6️⃣ Getting gas price...');
        const gasPrice = await provider.getFeeData();
        console.log(`   Gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);

        // 7. Try actual transaction
        console.log('7️⃣ Attempting transaction...');
        const tx = await contract.createETHToTRONBridge(hashlock, tronAddress, { 
            value,
            gasLimit: 500000 // Set a high gas limit
        });
        
        console.log(`✅ Transaction sent: ${tx.hash}`);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Transaction status: ${receipt.status ? 'Success' : 'Failed'}`);

        if (receipt.logs.length > 0) {
            console.log(`   Events emitted: ${receipt.logs.length}`);
        }

    } catch (error) {
        console.log('❌ Transaction failed:');
        console.log(`   Error: ${error.reason || error.message}`);
        
        if (error.code) {
            console.log(`   Code: ${error.code}`);
        }
        
        if (error.data) {
            console.log(`   Data: ${error.data}`);
        }

        // Decode common error patterns
        if (error.message.includes('execution reverted')) {
            console.log('💡 The contract execution reverted. This means a require() statement failed.');
        }
        
        if (error.message.includes('CALL_EXCEPTION')) {
            console.log('💡 Call exception occurred - check contract method exists and parameters are correct.');
        }
    }
}

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Run the debug script
debugBridgeTransaction().catch(console.error);
