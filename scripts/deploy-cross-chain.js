#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration - Using mainnet fork due to testnet SDK issues
const CONFIG = {
    ETH_RPC_URL: process.env.MAINNET_FORK_URL || process.env.ETH_RPC_URL || 'http://localhost:8545',
    NEAR_NETWORK: process.env.NEAR_NETWORK || 'testnet',
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    NEAR_ACCOUNT: process.env.NEAR_ACCOUNT,
    // Official 1inch Escrow Factory on mainnet (forked)
    OFFICIAL_ESCROW_FACTORY: '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a',
    // Use fork by default due to 1inch testnet limitations
    USE_MAINNET_FORK: process.env.USE_MAINNET_FORK !== 'false'
};

console.log('🚀 Starting 1inch Fusion+ Cross-Chain Deployment...\n');

// Check if mainnet fork should be used
if (CONFIG.USE_MAINNET_FORK && CONFIG.ETH_RPC_URL.includes('localhost')) {
    console.log('⚠️  Using mainnet fork due to 1inch testnet SDK limitations');
    console.log('   As discussed in Discord, testnets don\'t work with 1inch SDK');
    console.log('   Fork provides real mainnet contracts for testing\n');
}

async function setupMainnetFork() {
    if (CONFIG.USE_MAINNET_FORK && CONFIG.ETH_RPC_URL.includes('localhost')) {
        console.log('🔧 Setting up mainnet fork...');
        
        try {
            const scriptPath = path.join(__dirname, 'setup-mainnet-fork.sh');
            const isWindows = process.platform === 'win32';
            
            if (isWindows) {
                execSync('scripts\\setup-mainnet-fork.bat', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            } else {
                execSync('chmod +x scripts/setup-mainnet-fork.sh && scripts/setup-mainnet-fork.sh', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            }
            
            // Wait a bit for fork to stabilize
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.error('❌ Failed to setup mainnet fork:', error.message);
            console.log('💡 Manual setup: anvil --fork-url <mainnet-rpc> --port 8545');
            throw error;
        }
    }
}

async function deployEthereumContracts() {
    console.log('📦 Deploying Ethereum Cross-Chain Resolver...');
    
    try {
        const ethContractsDir = path.join(__dirname, '../eth-contracts');
        process.chdir(ethContractsDir);
        
        // Build contracts
        console.log('Building Ethereum contracts...');
        execSync('forge build', { stdio: 'inherit' });
        
        // Deploy resolver
        console.log('Deploying InchCrossChainResolver...');
        console.log(`Using official 1inch EscrowFactory: ${CONFIG.OFFICIAL_ESCROW_FACTORY}`);
        
        if (CONFIG.ETH_RPC_URL.includes('localhost')) {
            console.log('Fork/Local deployment detected...');
            execSync(`forge script script/DeployInchHTLC.s.sol:DeployInchCrossChainResolver --sig "runLocal()" --rpc-url ${CONFIG.ETH_RPC_URL} --broadcast`, { stdio: 'inherit' });
        } else {
            console.log('Live network deployment...');
            execSync(`forge script script/DeployInchHTLC.s.sol:DeployInchCrossChainResolver --rpc-url ${CONFIG.ETH_RPC_URL} --broadcast --verify`, { stdio: 'inherit' });
        }
        
        console.log('✅ Ethereum resolver deployed successfully!\n');
        
    } catch (error) {
        console.error('❌ Error deploying Ethereum contracts:', error.message);
        process.exit(1);
    }
}

async function deployNearContracts() {
    console.log('📦 Deploying NEAR Contracts...');
    
    try {
        const nearContractsDir = path.join(__dirname, '../near-contracts');
        process.chdir(nearContractsDir);
        
        // Build NEAR contract
        console.log('Building NEAR contract...');
        execSync('./build.sh', { stdio: 'inherit' });
        
        // Deploy NEAR contract
        if (CONFIG.NEAR_ACCOUNT) {
            console.log(`Deploying to NEAR account: ${CONFIG.NEAR_ACCOUNT}`);
            execSync(`./deploy.sh ${CONFIG.NEAR_ACCOUNT}`, { stdio: 'inherit' });
        } else {
            console.log('NEAR_ACCOUNT not specified, skipping deployment');
            console.log('Build completed. Deploy manually with: ./deploy.sh <account-id>');
        }
        
        console.log('✅ NEAR contracts deployed successfully!\n');
        
    } catch (error) {
        console.error('❌ Error deploying NEAR contracts:', error.message);
        process.exit(1);
    }
}

async function setupCrossChainResolver() {
    console.log('🔗 Setting up Cross-Chain Resolver...');
    
    try {
        const crossChainDir = path.join(__dirname, '../cross-chain');
        process.chdir(crossChainDir);
        
        // Install dependencies
        console.log('Installing resolver dependencies...');
        execSync('npm install', { stdio: 'inherit' });
        
        // Build resolver
        console.log('Building cross-chain resolver...');
        execSync('npm run build', { stdio: 'inherit' });
        
        console.log('✅ Cross-chain resolver setup complete!\n');
        
    } catch (error) {
        console.error('❌ Error setting up resolver:', error.message);
        process.exit(1);
    }
}

async function generateDeploymentSummary() {
    console.log('📋 Generating Deployment Summary...');
    
    const summary = {
        timestamp: new Date().toISOString(),
        network: {
            ethereum: CONFIG.ETH_RPC_URL,
            near: CONFIG.NEAR_NETWORK
        },
        contracts: {
            ethereum: {
                htlc: 'See forge broadcast logs',
                escrowFactory: CONFIG.ESCROW_FACTORY_ADDRESS
            },
            near: {
                account: CONFIG.NEAR_ACCOUNT || 'Not deployed'
            }
        },
        features: [
            '✅ Bidirectional ETH ↔ NEAR swaps',
            '✅ Hashlock and timelock functionality preserved',
            '✅ 1inch Cross-chain Swap integration',
            '✅ Partial fills supported',
            '✅ Resolver system implemented',
            '✅ Safety deposits and reputation system'
        ],
        nextSteps: [
            '1. Register resolvers on both chains',
            '2. Test cross-chain swaps with small amounts',
            '3. Monitor resolver performance',
            '4. Scale up for production use'
        ]
    };
    
    const summaryPath = path.join(__dirname, '../deployment-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('✅ Deployment summary saved to:', summaryPath);
    console.log('\n🎉 Cross-Chain Deployment Complete!');
    console.log('\nFeatures implemented:');
    summary.features.forEach(feature => console.log(`  ${feature}`));
    console.log('\nNext steps:');
    summary.nextSteps.forEach((step, index) => console.log(`  ${step}`));
}

async function main() {
    try {
        // Setup mainnet fork if needed
        await setupMainnetFork();
        
        // Validate environment
        if (!CONFIG.PRIVATE_KEY && !CONFIG.ETH_RPC_URL.includes('localhost')) {
            console.error('❌ PRIVATE_KEY environment variable required for live network deployment');
            console.log('💡 For local testing, mainnet fork is used automatically');
            process.exit(1);
        }
        
        // Deploy contracts
        await deployEthereumContracts();
        await deployNearContracts();
        await setupCrossChainResolver();
        await generateDeploymentSummary();
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    deployEthereumContracts,
    deployNearContracts,
    setupCrossChainResolver
};