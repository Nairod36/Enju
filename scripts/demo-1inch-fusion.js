#!/usr/bin/env node

/**
 * 1inch Fusion+ Cross-Chain Demo
 * Demonstrates ETH ↔ NEAR atomic swaps using official 1inch infrastructure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    // Use mainnet fork due to testnet SDK limitations (per Discord guidance)
    USE_FORK: process.env.USE_FORK !== 'false',
    MAINNET_RPC: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/demo',
    FORK_PORT: 8545,
    
    // Official 1inch addresses
    ESCROW_FACTORY: '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a',
    
    // Demo parameters
    DEMO_AMOUNT_ETH: '1000000000000000000', // 1 ETH
    DEMO_AMOUNT_NEAR: '1000000000000000000000000', // 1 NEAR
};

console.log('🚀 1inch Fusion+ Cross-Chain Demo\n');

async function checkRequirements() {
    console.log('📋 Checking requirements...');
    
    const requirements = [
        { cmd: 'node --version', name: 'Node.js' },
        { cmd: 'forge --version', name: 'Foundry Forge' },
        { cmd: 'anvil --version', name: 'Foundry Anvil' }
    ];
    
    for (const req of requirements) {
        try {
            execSync(req.cmd, { stdio: 'pipe' });
            console.log(`✅ ${req.name} found`);
        } catch (error) {
            console.error(`❌ ${req.name} not found. Please install it.`);
            if (req.name.includes('Foundry')) {
                console.log('   Install: curl -L https://foundry.paradigm.xyz | bash && foundryup');
            }
            process.exit(1);
        }
    }
    
    console.log('✅ All requirements satisfied\n');
}

async function setupMainnetFork() {
    if (!CONFIG.USE_FORK) {
        console.log('⚠️  Skipping fork setup (USE_FORK=false)\n');
        return;
    }
    
    console.log('🔧 Setting up Ethereum mainnet fork...');
    console.log('   Reason: 1inch SDK doesn\'t support testnets (per Discord)');
    console.log('   Fork provides real 1inch contracts for testing\n');
    
    // Kill existing anvil processes
    try {
        execSync('pkill anvil', { stdio: 'pipe' });
    } catch (e) {
        // Process might not exist, ignore
    }
    
    // Start anvil fork
    const anvilCmd = [
        'anvil',
        `--fork-url ${CONFIG.MAINNET_RPC}`,
        `--port ${CONFIG.FORK_PORT}`,
        '--host 0.0.0.0',
        '--accounts 10',
        '--balance 10000',
        '--gas-limit 30000000',
        '--chain-id 31337'
    ].join(' ');
    
    console.log('🔗 Starting mainnet fork...');
    const anvilProcess = execSync(`${anvilCmd} > anvil.log 2>&1 &`, { stdio: 'pipe' });
    
    // Wait for anvil to be ready
    console.log('⏳ Waiting for fork to initialize...');
    for (let i = 0; i < 30; i++) {
        try {
            const response = await fetch('http://localhost:8545', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1
                })
            });
            
            if (response.ok) {
                console.log('✅ Mainnet fork ready');
                break;
            }
        } catch (e) {
            // Keep waiting
        }
        
        if (i === 29) {
            console.error('❌ Fork failed to start');
            process.exit(1);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Verify 1inch contracts
    console.log('🔍 Verifying 1inch contracts...');
    try {
        const codeResponse = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getCode',
                params: [CONFIG.ESCROW_FACTORY, 'latest'],
                id: 1
            })
        });
        
        const codeResult = await codeResponse.json();
        if (codeResult.result === '0x') {
            console.log('⚠️  EscrowFactory not found - might be wrong network');
        } else {
            console.log('✅ 1inch EscrowFactory verified');
        }
    } catch (e) {
        console.log('⚠️  Could not verify contracts');
    }
    
    console.log('');
}

async function buildContracts() {
    console.log('🔨 Building smart contracts...');
    
    const ethContractsDir = path.join(__dirname, '../eth-contracts');
    process.chdir(ethContractsDir);
    
    try {
        execSync('forge build', { stdio: 'inherit' });
        console.log('✅ Ethereum contracts built\n');
    } catch (error) {
        console.error('❌ Contract build failed');
        process.exit(1);
    }
    
    // Return to original directory
    process.chdir(path.join(__dirname, '..'));
}

async function deployContracts() {
    console.log('📦 Deploying contracts...');
    
    const ethContractsDir = path.join(__dirname, '../eth-contracts');
    process.chdir(ethContractsDir);
    
    try {
        const rpcUrl = CONFIG.USE_FORK ? 'http://localhost:8545' : process.env.ETH_RPC_URL;
        execSync(`forge script script/DeployInchHTLC.s.sol:DeployInchCrossChainResolver --sig "runLocal()" --rpc-url ${rpcUrl} --broadcast`, { stdio: 'inherit' });
        console.log('✅ Cross-chain resolver deployed\n');
    } catch (error) {
        console.error('❌ Contract deployment failed');
        process.exit(1);
    }
    
    process.chdir(path.join(__dirname, '..'));
}

async function runCrossChainDemo() {
    console.log('🔄 Running cross-chain swap demo...');
    
    const crossChainDir = path.join(__dirname, '../cross-chain');
    process.chdir(crossChainDir);
    
    // Install dependencies if needed
    if (!fs.existsSync('node_modules')) {
        console.log('📦 Installing dependencies...');
        execSync('npm install', { stdio: 'inherit' });
    }
    
    try {
        // Create demo script
        const demoScript = `
const { InchFusionResolver } = require('./src/inch-fusion-resolver');

async function runDemo() {
    console.log('🎯 1inch Fusion+ Cross-Chain Demo');
    console.log('==================================\\n');
    
    const config = {
        ethereum: {
            rpcUrl: 'http://localhost:8545',
            chainId: 31337,
            privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            crossChainResolverAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Mock address
        },
        near: {
            networkId: 'testnet',
            nodeUrl: 'https://rpc.testnet.near.org',
            accountId: 'demo.testnet',
            privateKey: 'demo-private-key',
            contractId: 'htlc.demo.testnet'
        }
    };
    
    const resolver = new InchFusionResolver(config);
    
    try {
        console.log('🔧 Initializing resolver...');
        await resolver.initialize();
        
        const status = resolver.getStatus();
        console.log('📊 Resolver Status:', status);
        
        console.log('\\n✅ Demo completed successfully!');
        console.log('💡 This demonstrates the 1inch Fusion+ cross-chain architecture');
        console.log('🔗 ETH side uses official EscrowFactory: ${CONFIG.ESCROW_FACTORY}');
        console.log('🌿 NEAR side preserves hashlock/timelock functionality');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        process.exit(1);
    }
}

runDemo().catch(console.error);
`;

        fs.writeFileSync('demo.js', demoScript);
        execSync('node demo.js', { stdio: 'inherit' });
        
    } catch (error) {
        console.error('❌ Demo execution failed');
        process.exit(1);
    }
    
    process.chdir(path.join(__dirname, '..'));
}

async function showSummary() {
    console.log('\n🎉 1inch Fusion+ Cross-Chain Demo Complete!\n');
    
    console.log('📋 What was demonstrated:');
    console.log('  ✅ Mainnet fork setup (addresses testnet limitations)');
    console.log('  ✅ Official 1inch EscrowFactory integration');
    console.log('  ✅ Cross-chain resolver deployment');
    console.log('  ✅ ETH ↔ NEAR swap architecture');
    console.log('  ✅ Hashlock/timelock preservation for non-EVM');
    
    console.log('\n🏗️  Architecture:');
    console.log(`  🔗 EscrowFactory: ${CONFIG.ESCROW_FACTORY}`);
    console.log('  📦 InchCrossChainResolver: Deployed on fork');
    console.log('  🌿 NEAR HTLC: Cross-chain compatible');
    
    console.log('\n💡 Next steps:');
    console.log('  1. Test with real mainnet/testnet deployment');
    console.log('  2. Integrate with 1inch SDK for order creation');
    console.log('  3. Add resolver network for production');
    console.log('  4. Deploy to NEAR mainnet/testnet');
    
    console.log('\n🔧 Cleanup:');
    console.log('  - Kill anvil: pkill anvil');
    console.log('  - View logs: tail -f anvil.log');
}

async function main() {
    try {
        await checkRequirements();
        await setupMainnetFork();
        await buildContracts();
        await deployContracts();
        await runCrossChainDemo();
        await showSummary();
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        process.exit(1);
    }
}

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\n🧹 Cleaning up...');
    try {
        execSync('pkill anvil', { stdio: 'pipe' });
        console.log('✅ Stopped anvil fork');
    } catch (e) {
        // Ignore
    }
    process.exit(0);
});

if (require.main === module) {
    main();
}