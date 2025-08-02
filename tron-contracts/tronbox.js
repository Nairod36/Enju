const port = process.env.HOST_PORT || 9090

module.exports = {
  networks: {
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 30,        // Reasonable percentage for deployment
      feeLimit: 1500 * 1e6,         // 1500 TRX limit (reasonable for current balance)
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2",
      consume_user_resource_percent: 30,  // Conservative resource usage
      name: 'shasta',
      originEnergyLimit: 10000000,  // 10M energy limit (TRON max allowed)
      deployOriginEnergyLimit: 10000000,  // 10M energy limit (TRON max allowed)
      createAccountFee: 100000
    },
    development: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 0,
      feeLimit: 100 * 1e6,
      fullHost: "http://127.0.0.1:" + port,
      network_id: "9"
    }
  },
  // TronBox-compatible compiler configuration
  compilers: {
    solc: {
      version: "0.8.6",
      optimizer: {
        enabled: true,
        runs: 200,                  // Balanced optimization for gas vs size
        details: {
          yul: true,                // Enable Yul optimizer
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200                 // Balanced optimization
        },
        evmVersion: "london"        // Use compatible EVM version
      }
    }
  }
}
