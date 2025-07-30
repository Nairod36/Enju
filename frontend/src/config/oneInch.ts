// 1inch API Configuration

export const ONEINCH_CONFIG = {
  // 1inch API endpoints
  apiBaseUrl: 'https://api.1inch.dev',
  
  // Supported chains
  supportedChains: {
    ethereum: {
      chainId: 1,
      name: 'Ethereum',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrl: 'https://ethereum.publicnode.com',
      blockExplorer: 'https://etherscan.io',
    },
    polygon: {
      chainId: 137,
      name: 'Polygon',
      nativeCurrency: {
        name: 'Polygon',
        symbol: 'MATIC',
        decimals: 18,
      },
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorer: 'https://polygonscan.com',
    },
    bsc: {
      chainId: 56,
      name: 'BSC',
      nativeCurrency: {
        name: 'Binance Coin',
        symbol: 'BNB',
        decimals: 18,
      },
      rpcUrl: 'https://bsc-dataseed.binance.org',
      blockExplorer: 'https://bscscan.com',
    },
    arbitrum: {
      chainId: 42161,
      name: 'Arbitrum One',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      blockExplorer: 'https://arbiscan.io',
    },
  },

  // Default slippage settings
  defaultSlippage: 1, // 1%
  slippageOptions: [0.5, 1, 2.5, 5], // Available slippage percentages

  // Gas settings
  gasMultiplier: 1.2, // 20% buffer for gas estimation

  // API rate limiting
  rateLimit: {
    requestsPerSecond: 2,
    requestsPerMinute: 100,
  },

  // Common token addresses for Ethereum
  commonTokens: {
    ethereum: {
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      USDC: '0xA0b86a33E6441e68B7f98b88e9D7b04eF4703Ee',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    },
  },

  // Error messages
  errorMessages: {
    insufficientLiquidity: 'Insufficient liquidity for this trade',
    networkMismatch: 'Please switch to the correct network',
    tokenNotSupported: 'Token is not supported on this network',
    amountTooSmall: 'Amount is too small for swap',
    amountTooLarge: 'Amount exceeds maximum swap size',
    gasEstimationFailed: 'Failed to estimate gas costs',
    approvalRequired: 'Token approval required before swap',
    swapFailed: 'Swap transaction failed',
    quoteFailed: 'Failed to get price quote',
  },

  // Feature flags
  features: {
    enableGasOptimization: true,
    enablePriceImpactWarning: true,
    enableSlippageProtection: true,
    enableMaxGasPrice: true,
    enablePartialFill: true,
  },

  // UI settings
  ui: {
    refreshInterval: 10000, // 10 seconds
    debounceDelay: 500, // 500ms for input debouncing
    animationDuration: 200, // Animation timing
  },
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Use testnet configurations in development
  ONEINCH_CONFIG.supportedChains.ethereum.rpcUrl = 'http://vps-b11044fd.vps.ovh.net:8545/';
}

export type ChainConfig = typeof ONEINCH_CONFIG.supportedChains.ethereum;
export type SupportedChain = keyof typeof ONEINCH_CONFIG.supportedChains;
