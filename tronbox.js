module.exports = {
  networks: {
    shasta: {
      privateKey: '3831fbdb98c130a6f6a737291e3be4973adfd2583f70598a4767c8fdc4427da5',
      userFeePercentage: 100,
      feeLimit: 1e8,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '2'
    }
  },
  compilers: {
    solc: {
      version: '0.8.6'
    }
  }
};