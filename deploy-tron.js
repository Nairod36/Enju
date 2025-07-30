const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// Configuration
const PRIVATE_KEY = '3831fbdb98c130a6f6a737291e3be4973adfd2583f70598a4767c8fdc4427da5';
const FULL_HOST = 'https://api.shasta.trongrid.io';
const SOLIDITY_NODE = 'https://api.shasta.trongrid.io';
const EVENT_SERVER = 'https://api.shasta.trongrid.io';

async function deployTronBridge() {
    try {
        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullHost: FULL_HOST,
            solidityNode: SOLIDITY_NODE,
            eventServer: EVENT_SERVER,
            privateKey: PRIVATE_KEY
        });

        console.log('TronWeb initialized successfully');
        
        // Get account address
        const address = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
        console.log('Deployer address:', address);

        // Check balance
        const balance = await tronWeb.trx.getBalance(address);
        console.log('Balance:', tronWeb.fromSun(balance), 'TRX');

        if (balance < 100000000) { // 100 TRX minimum
            throw new Error('Insufficient TRX balance for deployment');
        }

        // Read contract source
        const contractPath = path.join(__dirname, 'tron-contracts', 'TronDirectBridge.sol');
        const contractSource = fs.readFileSync(contractPath, 'utf8');
        
        console.log('Contract source loaded');

        // Compile contract
        const compiled = await tronWeb.transactionBuilder.createSmartContract({
            abi: [], // Will be populated after compilation
            bytecode: contractSource,
            name: "TronDirectBridge",
            callValue: 0,
            userFeePercentage: 1,
            originEnergyLimit: 10000000
        });

        console.log('Contract compiled and deployed');
        console.log('Contract address:', compiled.contract_address);
        
        return compiled.contract_address;

    } catch (error) {
        console.error('Deployment failed:', error.message);
        
        // Alternative deployment instruction
        console.log('\n=== ALTERNATIVE DEPLOYMENT METHOD ===');
        console.log('1. Go to https://shasta.tronscan.org/');
        console.log('2. Connect your wallet');
        console.log('3. Go to "Contract" > "Deploy Contract"');
        console.log('4. Paste the contract code from tron-contracts/TronDirectBridge.sol');
        console.log('5. Set compiler version to 0.8.6');
        console.log('6. Deploy the contract');
        console.log('7. Copy the contract address to your .env file');
        
        throw error;
    }
}

// Run deployment
deployTronBridge()
    .then((address) => {
        console.log('\n✅ Deployment successful!');
        console.log('Contract address:', address);
        console.log('\nAdd this to your .env file:');
        console.log(`TRON_BRIDGE_CONTRACT=${address}`);
    })
    .catch((error) => {
        console.error('\n❌ Deployment failed');
        process.exit(1);
    });