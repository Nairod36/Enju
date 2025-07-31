export const FORK_MAINNET_CONFIG = {
  chainId: 1, // Fork of mainnet keeps same chain ID
  name: 'Forked Mainnet',
  rpcUrl: process.env.NODE_ENV === 'development' 
    ? 'http://vps-b11044fd.vps.ovh.net:8545/' 
    : 'https://vps-b11044fd.vps.ovh.net:8545/', // Use HTTPS if available
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: null,
};

export const BRIDGE_CONFIG = {
  contractAddress: '0xaC7e97aC94f5b0708849bb622eCBAE69aE826038', // Nouveau contrat déployé avec support TRON
  rpcUrl: 'http://vps-b11044fd.vps.ovh.net:8545/',
  listenerApi: 'http://localhost:3002',
  nearContract: 'matthias-dev.testnet',
  inchEscrowFactory: '0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A',
  tron: {
    contractAddress: 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86', // À remplacer par votre vraie adresse
    network: 'shasta', // Testnet TRON
    rpcUrl: 'https://api.shasta.trongrid.io',
    apiKey: '5e8b38e2-9828-4737-af16-11b935808aca'
  }
};

export const switchToForkNetwork = async () => {
  if (!window.ethereum) {
    alert('MetaMask not installed');
    return false;
  }

  // MetaMask doesn't support HTTP RPC URLs for wallet_addEthereumChain
  // Show manual instructions instead
  console.log('⚠️ MetaMask requires manual network configuration for HTTP RPC');
  console.log('');
  console.log('📋 Please add this network manually in MetaMask:');
  console.log('1. Open MetaMask → Settings → Networks → Add Network');
  console.log('2. Click "Add a network manually"');
  console.log('3. Fill in these details:');
  console.log(`   Network Name: ${FORK_MAINNET_CONFIG.name}`);
  console.log(`   New RPC URL: ${FORK_MAINNET_CONFIG.rpcUrl}`);
  console.log(`   Chain ID: ${FORK_MAINNET_CONFIG.chainId} (or 0x1)`);
  console.log(`   Currency Symbol: ETH`);
  console.log('4. Click "Save" and switch to this network');
  console.log('');
  console.log('💡 Then click "Connect MetaMask" again');

  // Try to switch to the network in case user already added it
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${FORK_MAINNET_CONFIG.chainId.toString(16)}` }],
    });
    
    console.log('✅ Successfully switched to Fork Mainnet');
    return true;
    
  } catch (switchError: any) {
    console.log('ℹ️ Network not found - please add it manually using instructions above');
    return false;
  }
};