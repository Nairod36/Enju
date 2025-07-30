/**
 * Local Mainnet Fork Utilities
 * 
 * Helper utilities for connecting to and working with the local Ethereum mainnet fork.
 * This provides test accounts with plenty of ETH for development and testing.
 */

import { ethers } from 'ethers';

// Your local mainnet fork configuration
export const LOCAL_FORK_CONFIG = {
  rpcUrl: 'http://vps-b11044fd.vps.ovh.net:8545',
  chainId: 1, // Still reports as mainnet (chain ID 1)
  name: 'Local Mainnet Fork',
};

// Test accounts from Anvil (first 10 accounts with 1000 ETH each)
export const TEST_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Test Account #0'
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    name: 'Test Account #1'
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    name: 'Test Account #2'
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    name: 'Test Account #3'
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    name: 'Test Account #4'
  },
];

/**
 * Create a provider connected to the local mainnet fork
 */
export function createLocalForkProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(LOCAL_FORK_CONFIG.rpcUrl);
}

/**
 * Get a signer for a test account
 */
export function getTestAccountSigner(accountIndex: number = 0): ethers.Wallet {
  if (accountIndex >= TEST_ACCOUNTS.length) {
    throw new Error(`Test account index ${accountIndex} is out of range`);
  }
  
  const account = TEST_ACCOUNTS[accountIndex];
  const provider = createLocalForkProvider();
  return new ethers.Wallet(account.privateKey, provider);
}

/**
 * Check if we're connected to the local fork
 */
export async function isConnectedToLocalFork(): Promise<boolean> {
  try {
    // Check if wallet is connected to our fork
    if (!window.ethereum) return false;
    
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    const network = await provider.getNetwork();
    
    // For now, just check if we're on mainnet (chainId 1)
    // In a real scenario, you might add a custom identifier
    return network.chainId === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Get network connection instructions for MetaMask
 */
export function getMetaMaskInstructions() {
  return {
    networkName: 'Local Mainnet Fork',
    rpcUrl: LOCAL_FORK_CONFIG.rpcUrl,
    chainId: '0x1', // Hex for chain ID 1
    currencySymbol: 'ETH',
    blockExplorerUrl: '', // No block explorer for local fork
    instructions: [
      '1. Open MetaMask',
      '2. Click on the network dropdown (usually shows "Ethereum Mainnet")',
      '3. Click "Add Network" or "Custom RPC"',
      '4. Enter the following details:',
      `   - Network Name: ${LOCAL_FORK_CONFIG.name}`,
      `   - RPC URL: ${LOCAL_FORK_CONFIG.rpcUrl}`,
      `   - Chain ID: 1`,
      `   - Currency Symbol: ETH`,
      '5. Save the network',
      '6. Import one of the test accounts using the private key',
    ]
  };
}

/**
 * Check account balance on the local fork
 */
export async function checkAccountBalance(address: string): Promise<string> {
  try {
    const provider = createLocalForkProvider();
    const balance = await provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error('Error checking balance:', error);
    return '0';
  }
}

/**
 * Fund an account on the local fork (if you have access to a funded account)
 */
export async function fundAccount(
  toAddress: string, 
  amount: string, 
  fromAccountIndex: number = 0
): Promise<string> {
  try {
    const signer = getTestAccountSigner(fromAccountIndex);
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.utils.parseEther(amount),
    });
    
    console.log(`💰 Funded ${toAddress} with ${amount} ETH`);
    console.log(`📝 Transaction hash: ${tx.hash}`);
    
    return tx.hash;
  } catch (error) {
    console.error('Error funding account:', error);
    throw error;
  }
}

/**
 * Display helpful development information
 */
export function displayForkInfo() {
  console.log('🔗 LOCAL MAINNET FORK INFORMATION:');
  console.log(`📡 RPC URL: ${LOCAL_FORK_CONFIG.rpcUrl}`);
  console.log(`🆔 Chain ID: ${LOCAL_FORK_CONFIG.chainId}`);
  console.log('\n💰 TEST ACCOUNTS (each has 1000 ETH):');
  
  TEST_ACCOUNTS.forEach((account) => {
    console.log(`\n${account.name}:`);
    console.log(`  Address: ${account.address}`);
    console.log(`  Private Key: ${account.privateKey}`);
  });
  
  console.log('\n🔧 METAMASK SETUP:');
  const instructions = getMetaMaskInstructions();
  instructions.instructions.forEach(instruction => {
    console.log(`  ${instruction}`);
  });
}
