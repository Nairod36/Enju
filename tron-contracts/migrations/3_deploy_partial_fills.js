const TronPartialFills = artifacts.require("TronPartialFills");

module.exports = async function(deployer, network, accounts) {
  console.log("Deploying to network:", network);
  console.log("Deploying from account:", accounts[0]);

  try {
    // Deploy TronPartialFills contract
    console.log("Deploying TronPartialFills...");
    await deployer.deploy(TronPartialFills, {
      from: accounts[0],
      value: web3.utils.toWei('100', 'ether') // Initial funding with 100 TRX
    });

    const partialFillsInstance = await TronPartialFills.deployed();
    console.log("TronPartialFills deployed at:", partialFillsInstance.address);

    // Set up initial configuration if needed
    console.log("Setting up initial configuration...");
    
    // Authorize the deployer as resolver for testing
    const minDeposit = await partialFillsInstance.MIN_SAFETY_DEPOSIT();
    console.log("Minimum safety deposit:", minDeposit.toString());
    
    // Register deployer as authorized resolver
    console.log("Authorizing deployer as resolver...");
    await partialFillsInstance.authorizeResolver(accounts[0], {
      from: accounts[0],
      value: minDeposit
    });

    console.log("✅ TronPartialFills deployment completed successfully!");
    console.log("Contract address:", partialFillsInstance.address);
    console.log("Owner:", accounts[0]);
    console.log("Initial balance:", await web3.eth.getBalance(partialFillsInstance.address));

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
};