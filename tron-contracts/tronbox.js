const port = process.env.HOST_PORT || 9090

module.exports = {
  networks: {
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,       // Max percentage for deployment
      feeLimit: 15000 * 1e6,        // 15000 TRX limit!! (EXTREME MAX)
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2",
      consume_user_resource_percent: 100,  // Use max user resources
      name: 'shasta',
      originEnergyLimit: 100000000,  // 100M energy limit (EXTREME MAX)
      deployOriginEnergyLimit: 100000000,
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
        runs: 1,                    // Most aggressive optimization for smaller bytecode
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
          runs: 1
        }
      }
    }
  }
}
