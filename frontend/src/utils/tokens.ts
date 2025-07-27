// Utilitaires pour les tokens

export const getTokenAddress = (tokenSymbol: string): string => {
  const tokenAddresses: { [key: string]: string } = {
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH natif
    'USDC': '0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2', // USDC sur Ethereum
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT sur Ethereum
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC sur Ethereum
  };
  
  return tokenAddresses[tokenSymbol] || tokenAddresses['ETH'];
};

export const parseEther = (amount: string): string => {
  // Convertir en wei (18 décimales)
  const etherAmount = parseFloat(amount);
  const weiAmount = etherAmount * Math.pow(10, 18);
  return weiAmount.toString();
};

export const formatAmount = (amount: string, decimals: number = 18): string => {
  const numAmount = parseFloat(amount);
  const formattedAmount = numAmount / Math.pow(10, decimals);
  return formattedAmount.toString();
};