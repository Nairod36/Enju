const port = process.env.HOST_PORT || 9090

module.exports = {
  networks: {
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 25,        // Reduced fee percentage for deployment
      feeLimit: 1000 * 1e6,         // 1000 TRX limit for complex contract
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2"
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
        runs: 1                     // Aggressive optimization for smaller bytecode
      }
    }
  }
}
