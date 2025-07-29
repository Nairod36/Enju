module.exports = {
  networks: {
    mainnet: {
      // Don't put your private key here:
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1e8,
      fullHost: "https://api.trongrid.io",
      network_id: "1"
    },
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 50,
      feeLimit: 1e8,
      fullHost: "https://api.shasta.trongrid.io",
      network_id: "2"
    },
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1e8,
      fullHost: "https://nile.trongrid.io",
      network_id: "3"
    },
    development: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 0,
      feeLimit: 1e8,
      fullHost: "http://127.0.0.1:9090",
      network_id: "9"
    },
    compilers: {
      solc: {
        version: "0.8.6"
      }
    }
  },
  // if you are use tronide to debug, you must set useZeroFeeContract=true
  useZeroFeeContract: true
};
