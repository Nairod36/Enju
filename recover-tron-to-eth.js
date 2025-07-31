const { ethers } = require('ethers');

async function recoverTronToEth() {
  try {
    console.log('🚨 RECOVERING TRON → ETH Bridge...');
    
    // Vos TRX détectés dans le contrat bridge
    const trxReceived = 1681.229733;
    const ethAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    
    // Conversion TRX → ETH
    const trxToEthRate = 0.000086786310296416;
    const ethAmount = (trxReceived * trxToEthRate).toFixed(6);
    
    console.log(`📊 TRX received in bridge: ${trxReceived} TRX`);
    console.log(`💱 Converting to: ${ethAmount} ETH`);
    console.log(`📍 ETH destination: ${ethAddress}`);
    
    // Configuration ETH
    const provider = new ethers.providers.JsonRpcProvider('http://vps-b11044fd.vps.ovh.net/rpc');
    const relayerPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(relayerPrivateKey, provider);
    
    console.log('📊 Relayer ETH address:', signer.address);
    
    // Vérifier le solde ETH du relayer
    const balance = await provider.getBalance(signer.address);
    const balanceInEth = ethers.utils.formatEther(balance);
    
    console.log(`💰 Relayer ETH balance: ${balanceInEth} ETH`);
    
    if (parseFloat(balanceInEth) < parseFloat(ethAmount)) {
      console.log(`❌ Insufficient ETH balance for transfer`);
      console.log(`💡 Required: ${ethAmount} ETH`);
      console.log(`💡 Available: ${balanceInEth} ETH`);
      return;
    }
    
    // Envoyer ETH à l'utilisateur
    const ethAmountWei = ethers.utils.parseEther(ethAmount);
    
    console.log(`💸 Sending ${ethAmount} ETH to ${ethAddress}...`);
    
    const tx = await signer.sendTransaction({
      to: ethAddress,
      value: ethAmountWei,
      gasLimit: 21000,
      gasPrice: ethers.utils.parseUnits('20', 'gwei')
    });
    
    console.log(`✅ ETH transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    console.log(`✅ ETH transaction confirmed in block ${receipt.blockNumber}`);
    console.log('');
    console.log('🎉 TRON → ETH BRIDGE RECOVERED!');
    console.log(`📤 Sent: ${ethAmount} ETH`);
    console.log(`📍 To: ${ethAddress}`);
    console.log(`💱 From: ${trxReceived} TRX`);
    console.log(`🔗 Transaction: ${tx.hash}`);
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  }
}

recoverTronToEth();