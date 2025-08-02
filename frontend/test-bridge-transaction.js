import { ethers } from 'ethers';

async function testBridgeTransaction() {
  try {
    const provider = new ethers.providers.JsonRpcProvider('http://vps-b11044fd.vps.ovh.net/rpc');
    const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(testPrivateKey, provider);
    
    console.log('🔗 Testing ETH → TRON Bridge Transaction');
    console.log('From:', signer.address);
    console.log('Balance:', ethers.utils.formatEther(await provider.getBalance(signer.address)), 'ETH');
    
    // Contract ABI (simplified for testing)
    const contractABI = [
      "function createETHToTRONBridge(bytes32 hashlock, string calldata tronAddress) external payable returns (address escrow)",
      "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, uint8 indexed destinationChain, string destinationAccount, uint256 amount)"
    ];
    
    const contractAddress = '0x79fD45793DC81Da9BaB6aE577f01ba7935484C51';
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // Generate a test secret and hashlock
    const secret = ethers.utils.randomBytes(32);
    const hashlock = ethers.utils.sha256(secret);
    
    const tronAddress = 'TMGSeM3QLUJEbdscQnMt9ujx843arknWb2';
    const bridgeAmount = ethers.utils.parseEther('0.001'); // 0.001 ETH
    
    console.log('Secret:', ethers.utils.hexlify(secret));
    console.log('Hashlock:', hashlock);
    console.log('TRON Address:', tronAddress);
    console.log('Bridge Amount:', ethers.utils.formatEther(bridgeAmount), 'ETH');
    
    // Estimate gas
    console.log('\\n🔍 Estimating gas...');
    let gasEstimate;
    try {
      gasEstimate = await contract.estimateGas.createETHToTRONBridge(hashlock, tronAddress, {
        value: bridgeAmount
      });
      console.log('Gas estimate:', gasEstimate.toString());
    } catch (estimateError) {
      console.log('⚠️ Gas estimation failed:', estimateError.message);
      console.log('Using default gas limit: 300000');
      gasEstimate = ethers.BigNumber.from('300000');
    }
    
    // Execute transaction
    console.log('\\n🚀 Executing bridge transaction...');
    const tx = await contract.createETHToTRONBridge(hashlock, tronAddress, {
      value: bridgeAmount,
      gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
      gasPrice: ethers.utils.parseUnits('20', 'gwei')
    });
    
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Transaction status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    
    // Parse events
    if (receipt.logs && receipt.logs.length > 0) {
      console.log('\\n📋 Events:');
      receipt.logs.forEach((log, index) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          console.log(`Event ${index}:`, parsedLog.name);
          console.log('Args:', parsedLog.args);
        } catch (e) {
          console.log(`Event ${index}: Raw log`, log);
        }
      });
    }
    
    if (receipt.status === 1) {
      console.log('\\n🎉 Bridge transaction successful!');
      console.log('The bridge-listener should detect this transaction and send TRX automatically.');
    } else {
      console.log('\\n❌ Bridge transaction failed!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

testBridgeTransaction();