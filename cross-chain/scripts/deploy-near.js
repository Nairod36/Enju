const { connect, keyStores, utils } = require('near-api-js');
const fs = require('fs');
const path = require('path');

async function deployNEAR() {
    console.log('🌐 Deploying NEAR HTLC Contract...');
    
    try {
        // NEAR configuration
        const config = {
            networkId: 'testnet',
            nodeUrl: 'https://rpc.testnet.near.org',
            walletUrl: 'https://wallet.testnet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            explorerUrl: 'https://explorer.testnet.near.org'
        };
        
        // Check if account key exists
        const keyPath = path.join(__dirname, '../.near-credentials/testnet');
        
        if (!fs.existsSync(keyPath)) {
            console.log('❌ NEAR credentials not found');
            console.log('📝 To deploy NEAR contracts:');
            console.log('1. Install NEAR CLI: npm install -g near-cli');
            console.log('2. Create account: near create-account your-account.testnet --useFaucet');
            console.log('3. Login: near login');
            console.log('4. Run this script again');
            return false;
        }
        
        // Create keystore
        const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
            path.join(__dirname, '../.near-credentials')
        );
        
        const near = await connect({ ...config, keyStore });
        
        // Get account from environment or use default
        const accountId = process.env.NEAR_ACCOUNT_ID || 'cross-chain-test.testnet';
        const account = await near.account(accountId);
        
        console.log(`📱 Using NEAR account: ${accountId}`);
        
        // Check if contract exists
        const contractPath = path.join(__dirname, '../../near-contracts/htlc-near/target/wasm32-unknown-unknown/release/htlc_near.wasm');
        
        if (!fs.existsSync(contractPath)) {
            console.log('❌ NEAR contract WASM not found');
            console.log('📝 To build NEAR contract:');
            console.log('1. cd near-contracts');
            console.log('2. bash build.sh');
            console.log('3. Run this script again');
            return false;
        }
        
        // Deploy contract
        console.log('🚀 Deploying HTLC contract to NEAR...');
        const contractCode = fs.readFileSync(contractPath);
        
        const result = await account.deployContract(contractCode);
        console.log(`✅ NEAR HTLC deployed!`);
        console.log(`📍 Transaction: ${result.transaction.hash}`);
        
        // Initialize contract
        console.log('⚙️ Initializing contract...');
        const contract = new near.Contract(account, accountId, {
            viewMethods: ['get_contract', 'check_preimage'],
            changeMethods: ['create_htlc', 'withdraw', 'refund']
        });
        
        // Save deployment info
        const deploymentInfo = {
            accountId,
            contractId: accountId,
            networkId: config.networkId,
            transactionHash: result.transaction.hash,
            timestamp: Date.now()
        };
        
        const deploymentPath = path.join(__dirname, '../deployments/htlc-near.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('📝 NEAR deployment info saved to deployments/htlc-near.json');
        console.log('🎉 NEAR deployment complete!');
        
        return true;
        
    } catch (error) {
        console.error('❌ NEAR deployment failed:', error.message);
        
        if (error.message.includes('UnknownAccount')) {
            console.log('💡 Create a NEAR testnet account first:');
            console.log('   https://wallet.testnet.near.org/');
        }
        
        return false;
    }
}

if (require.main === module) {
    deployNEAR().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { deployNEAR };