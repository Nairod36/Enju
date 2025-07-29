const TronDirectBridge = artifacts.require("TronDirectBridge");

module.exports = function(deployer) {
  deployer.deploy(TronDirectBridge);
};
