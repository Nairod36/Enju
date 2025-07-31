import { ethers } from 'ethers';

async function debugContract() {
  try {
    const provider = new ethers.providers.JsonRpcProvider('http://vps-b11044fd.vps.ovh.net/rpc');
    const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(testPrivateKey, provider);
    
    console.log('🔍 Debugging Contract at 0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149');
    
    const contractABI = [
      "function checkEscrowFactory() external view returns (bool)",
      "function owner() public view returns (address)",
      "function authorizedResolvers(address) public view returns (bool)"
    ];
    
    const contractAddress = '0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149';
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // Test 1: Check owner
    console.log('\\n1. Checking contract owner...');
    try {
      const owner = await contract.owner();
      console.log('Contract owner:', owner);
      console.log('Current account:', signer.address);
      console.log('Is owner?', owner.toLowerCase() === signer.address.toLowerCase());
    } catch (e) {
      console.log('Error checking owner:', e.message);
    }
    
    // Test 2: Check if authorized
    console.log('\\n2. Checking authorization...');
    try {
      const isAuthorized = await contract.authorizedResolvers(signer.address);
      console.log('Is authorized resolver?', isAuthorized);
    } catch (e) {
      console.log('Error checking authorization:', e.message);
    }
    
    // Test 3: Check EscrowFactory
    console.log('\\n3. Checking EscrowFactory...');
    try {
      const factoryExists = await contract.checkEscrowFactory();
      console.log('EscrowFactory exists?', factoryExists);
    } catch (e) {
      console.log('Error checking EscrowFactory:', e.message);
    }
    
    // Test 4: Check network and balance
    console.log('\\n4. Network info...');
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(signer.address);
    console.log('Network:', network);
    console.log('Balance:', ethers.utils.formatEther(balance), 'ETH');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugContract();