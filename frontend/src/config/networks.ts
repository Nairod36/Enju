export const FORK_MAINNET_CONFIG = {
  chainId: 1, // Keep mainnet chain ID for fork
  name: 'Fork Mainnet',
  rpcUrl: 'http://vps-b11044fd.vps.ovh.net:8545/',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: null,
};

export const BRIDGE_CONFIG = {
  contractAddress: '0x81fA25baDbe26BAbbD95A457a8d78c73C5B99db4',
  rpcUrl: 'http://vps-b11044fd.vps.ovh.net:8545/',
  listenerApi: 'http://localhost:3002',
  nearContract: 'matthias-dev.testnet',
  inchEscrowFactory: '0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A',
};

export const switchToForkNetwork = async () => {
  if (!window.ethereum) {
    alert('MetaMask not installed');
    return false;
  }

  // MetaMask doesn't allow HTTP RPC URLs anymore
  // We'll skip automatic network addition and use manual connection
  console.log('⚠️ Automatic network addition not supported for HTTP RPC');
  console.log('Please add network manually in MetaMask:');
  console.log(`Network Name: Fork Mainnet`);
  console.log(`RPC URL: ${FORK_MAINNET_CONFIG.rpcUrl}`);
  console.log(`Chain ID: 1337 (or 31337)`);
  console.log(`Currency: ETH`);
  
  return false; // Always return false to trigger fallback mode
};