const { ethers } = require('ethers');

async function verifyFork() {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // 1inch Limit Order Protocol contract address
    const ONE_INCH_ADDRESS = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
    
    try {
        const code = await provider.getCode(ONE_INCH_ADDRESS);
        const blockNumber = await provider.getBlockNumber();
        
        console.log('🔍 Fork Verification:');
        console.log(`📦 Block Number: ${blockNumber}`);
        console.log(`🏭 1inch Contract: ${code.length > 2 ? '✅ Found' : '❌ Not found'}`);
        console.log(`📍 Address: ${ONE_INCH_ADDRESS}`);
        console.log(`💾 Code Size: ${code.length} bytes`);
        
        if (code.length > 2) {
            console.log('✅ Mainnet fork setup complete!');
            return true;
        } else {
            console.log('❌ Fork not working properly');
            return false;
        }
    } catch (error) {
        console.error('❌ Fork verification failed:', error.message);
        return false;
    }
}

verifyFork().then(success => {
    process.exit(success ? 0 : 1);
});