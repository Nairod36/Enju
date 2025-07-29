const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function deployHTLC() {
    // Connect to fork
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const deployer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
    
    console.log('🚀 Deploying HTLC contract...');
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH`);
    
    try {
        // Read HTLC contract
        const contractPath = path.join(__dirname, '../../eth-contracts/out/HTLC.sol/HTLCEthereum.json');
        if (!fs.existsSync(contractPath)) {
            throw new Error('HTLC contract not found. Run: cd eth-contracts && forge build');
        }
        
        const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        const abi = contractJson.abi;
        const bytecode = contractJson.bytecode.object;
        
        // Deploy
        const factory = new ethers.ContractFactory(abi, bytecode, deployer);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        console.log(`✅ HTLC deployed at: ${address}`);
        
        // Save deployment info
        const deploymentInfo = {
            address,
            abi,
            deployer: deployer.address,
            blockNumber: await provider.getBlockNumber(),
            timestamp: Date.now()
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../deployments/htlc-fork.json'),
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log('📝 Deployment info saved to deployments/htlc-fork.json');
        return { address, abi };
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        throw error;
    }
}

if (require.main === module) {
    deployHTLC().then(() => {
        console.log('🎉 Deployment complete!');
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { deployHTLC };