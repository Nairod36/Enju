import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
}

export interface WalletBalances {
  address: string;
  chainId: number;
  totalValueUsd: number;
  tokens: TokenBalance[];
  nativeToken: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
    priceUsd: number;
    valueUsd: number;
  };
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
  chainId: number;
  isVerified: boolean;
}

export interface SpotPrice {
  fromToken: TokenMetadata;
  toToken: TokenMetadata;
  fromAmount: string;
  toAmount: string;
  rate: number;
  timestamp: number;
}

@Injectable()
export class OneinchService {
  private readonly logger = new Logger(OneinchService.name);
  private readonly apiClient: AxiosInstance;
  private readonly baseURL = 'https://api.1inch.dev';
  
  // Rate limiting and cache
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1500; // 1.5 seconds between requests
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 60000; // 60 seconds cache
  private rateLimitDelay = 1500; // Dynamic delay that increases on 429 errors
  
  // Token addresses for different chains
  private readonly TOKENS = {
    // Ethereum mainnet (chainId: 1) - Local fork simplified
    1: {
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
    // Polygon (chainId: 137)
    137: {
      MATIC: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
    // BSC (chainId: 56)
    56: {
      BNB: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      USDT: '0x55d398326f99059fF775485246999027B3197955',
    }
  };

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('INCH_API_KEY');
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Log initialization
    this.logger.log('1inch API service initialized');
    this.logger.log(`API Key configured: ${!!apiKey}`);
    this.logger.log('Simplified for local mainnet fork - ETH only (1inch supported tokens)');
    this.logger.log(`Local fork mode: ${this.isLocalFork()}`);
  }

  /**
   * Check if we're running on a local mainnet fork
   */
  private isLocalFork(): boolean {
    const nodeUrl = this.configService.get<string>('ETH_RPC_URL') || '';
    return nodeUrl.includes('localhost') || nodeUrl.includes('127.0.0.1') || nodeUrl.includes('8545');
  }

  /**
   * Get mock wallet balances for local mainnet fork (ETH only)
   */
  private getLocalForkBalances(address: string, chainId: number): WalletBalances {
    return {
      address,
      chainId,
      totalValueUsd: 0, // Will be calculated in the frontend
      tokens: [], // No ERC20 tokens for simplicity
      nativeToken: {
        symbol: 'ETH',
        balance: '0',
        balanceFormatted: '0.000000',
        priceUsd: 3460.84,
        valueUsd: 0,
      },
    };
  }

  /**
   * Rate limiting helper - wait between requests to avoid 429 errors
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Handle rate limit errors with exponential backoff
   */
  private async handleRateLimit(error: any, retryCount: number = 0): Promise<void> {
    if (error.response?.status === 429 && retryCount < 3) {
      // Exponential backoff: 2s, 4s, 8s
      const backoffDelay = Math.pow(2, retryCount + 1) * 1000;
      this.rateLimitDelay = Math.max(this.rateLimitDelay, backoffDelay);
      
      this.logger.warn(`Rate limited (429). Backing off for ${backoffDelay}ms. Retry ${retryCount + 1}/3`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return;
    }
    
    // Reset delay on successful requests
    this.rateLimitDelay = 1500;
  }

  /**
   * Cache helper - get cached data if still valid
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      this.logger.debug(`Using cached data for: ${key}`);
      return cached.data;
    }
    return null;
  }

  /**
   * Cache helper - store data in cache
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get wallet balances using 1inch Portfolio API
   */
  async getWalletBalances(
    address: string, 
    chainId: number = 1
  ): Promise<WalletBalances> {
    try {
      this.logger.log(`Fetching wallet balances for ${address} on chain ${chainId}`);

      // For local fork, return mock data to avoid API calls
      if (this.isLocalFork() && chainId === 1) {
        this.logger.debug('Using local fork mock balances');
        return this.getLocalForkBalances(address, chainId);
      }

      const response = await this.apiClient.get(
        `/swap/v6.0/${chainId}/tokens`
      );

      const portfolioData = response.data;
      const tokens: TokenBalance[] = [];
      let totalValueUsd = 0;

      // Process ERC20 tokens
      if (portfolioData.result && portfolioData.result.length > 0) {
        const addressData = portfolioData.result[0];
        
        for (const [tokenAddress, tokenData] of Object.entries(addressData.erc20 || {})) {
          const token = tokenData as any;
          const balance = token.balance || '0';
          const decimals = token.decimals || 18;
          const balanceFormatted = (parseFloat(balance) / Math.pow(10, decimals)).toFixed(6);
          const priceUsd = token.price || 0;
          const valueUsd = parseFloat(balanceFormatted) * priceUsd;

          tokens.push({
            tokenAddress,
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown Token',
            decimals,
            balance,
            balanceFormatted,
            priceUsd,
            valueUsd,
          });

          totalValueUsd += valueUsd;
        }
      }

      // Get native token balance
      const nativeBalance = await this.getNativeTokenBalance(address, chainId);
      totalValueUsd += nativeBalance.valueUsd;

      return {
        address,
        chainId,
        totalValueUsd,
        tokens: tokens.sort((a, b) => b.valueUsd - a.valueUsd), // Sort by value DESC
        nativeToken: nativeBalance,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch wallet balances: ${error.message}`);
      throw new HttpException(
        `Failed to fetch wallet balances: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get native token balance (ETH, MATIC, BNB)
   */
  private async getNativeTokenBalance(address: string, chainId: number) {
    try {
      // Use 1inch balance API for native tokens
      const response = await this.apiClient.get(
        `/swap/v6.0/${chainId}/tokens`
      );

      const nativeTokenAddress = this.TOKENS[chainId]?.ETH || this.TOKENS[chainId]?.MATIC || this.TOKENS[chainId]?.BNB;
      const nativeBalance = response.data[nativeTokenAddress] || '0';
      const balanceFormatted = (parseFloat(nativeBalance) / Math.pow(10, 18)).toFixed(6);

      // Get native token price
      const priceUsd = await this.getNativeTokenPrice(chainId);
      const valueUsd = parseFloat(balanceFormatted) * priceUsd;

      const nativeSymbol = this.getNativeTokenSymbol(chainId);

      return {
        symbol: nativeSymbol,
        balance: nativeBalance,
        balanceFormatted,
        priceUsd,
        valueUsd,
      };

    } catch (error) {
      this.logger.warn(`Failed to fetch native token balance: ${error.message}`);
      return {
        symbol: this.getNativeTokenSymbol(chainId),
        balance: '0',
        balanceFormatted: '0.000000',
        priceUsd: 0,
        valueUsd: 0,
      };
    }
  }

  /**
   * Get native token price in USD
   */
  private async getNativeTokenPrice(chainId: number): Promise<number> {
    try {
      // For local mainnet fork, use fixed prices to avoid API calls
      if (chainId === 1) {
        this.logger.debug('Using fixed price for ETH on local mainnet fork');
        return 3460.84; // Fixed ETH price matching your dashboard
      }

      const nativeTokenAddress = this.TOKENS[chainId]?.ETH || 
                                 this.TOKENS[chainId]?.MATIC || 
                                 this.TOKENS[chainId]?.BNB;

      if (!nativeTokenAddress) return 0;

      const response = await this.getSpotPrice(
        nativeTokenAddress,
        this.TOKENS[1].USDT, // Use USDT as reference instead
        '1000000000000000000', // 1 token
        chainId
      );

      return parseFloat(response.toAmount) / Math.pow(10, 6); // USDT has 6 decimals

    } catch (error) {
      this.logger.warn(`Failed to fetch native token price: ${error.message}`);
      // Return fallback prices for local fork
      if (chainId === 1) return 3460.84; // ETH
      if (chainId === 137) return 0.80; // MATIC  
      if (chainId === 56) return 650; // BNB
      return 0;
    }
  }

  /**
   * Get native token symbol based on chain ID
   */
  private getNativeTokenSymbol(chainId: number): string {
    switch (chainId) {
      case 1: return 'ETH';
      case 137: return 'MATIC';
      case 56: return 'BNB';
      case 10: return 'ETH'; // Optimism
      case 42161: return 'ETH'; // Arbitrum
      default: return 'NATIVE';
    }
  }

  /**
   * Get token metadata using 1inch Token API
   */
  async getTokenMetadata(
    tokenAddress: string, 
    chainId: number = 1
  ): Promise<TokenMetadata> {
    try {
      this.logger.log(`Fetching token metadata for ${tokenAddress} on chain ${chainId}`);

      const response = await this.apiClient.get(
        `/swap/v6.0/${chainId}/tokens`
      );
      
      const tokenData = response.data.tokens[tokenAddress];
      
      if (!tokenData) {
        throw new Error('Token not found');
      }

      return {
        address: tokenData.address,
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        logoURI: tokenData.logoURI,
        tags: tokenData.tags || [],
        chainId,
        isVerified: !tokenData.tags?.includes('RISK:unverified'),
      };

    } catch (error) {
      this.logger.error(`Failed to fetch token metadata: ${error.message}`);
      throw new HttpException(
        `Failed to fetch token metadata: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get spot price using 1inch Price API with retry logic
   */
  async getSpotPrice(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    chainId: number = 1
  ): Promise<SpotPrice> {
    const cacheKey = `price_${fromTokenAddress}_${toTokenAddress}_${amount}_${chainId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // For local fork, use fallback prices directly to avoid API calls
    if (this.isLocalFork() && chainId === 1) {
      this.logger.debug('Using local fork prices, bypassing 1inch API');
      const result = this.getFallbackSpotPrice(fromTokenAddress, toTokenAddress, amount, chainId);
      this.setCachedData(cacheKey, result);
      return result;
    }

    // Try with retry logic for live networks
    for (let retryCount = 0; retryCount < 3; retryCount++) {
      try {
        this.logger.log(`Fetching spot price: ${fromTokenAddress} -> ${toTokenAddress} (attempt ${retryCount + 1})`);

        // Rate limiting
        await this.waitForRateLimit();

        // Try v6.0 endpoint first, fallback to v5.0
        let apiUrl = `/swap/v6.0/${chainId}/quote`;
        let response;
        
        try {
          response = await this.apiClient.get(apiUrl, {
            params: { 
              src: fromTokenAddress,
              dst: toTokenAddress,
              amount: amount
            }
          });
        } catch (v6Error) {
          // Fallback to v5.0 if v6.0 fails
          this.logger.debug(`v6.0 API failed, trying v5.0: ${v6Error.message}`);
          apiUrl = `/swap/v5.0/${chainId}/quote`;
          response = await this.apiClient.get(apiUrl, {
            params: { 
              fromTokenAddress: fromTokenAddress,
              toTokenAddress: toTokenAddress,
              amount: amount
            }
          });
        }

        const priceData = response.data;
        this.logger.debug(`1inch API response:`, JSON.stringify(priceData, null, 2));
        
        // Check if response has expected structure
        if (!priceData.toTokenAmount && !priceData.dstAmount) {
          this.logger.error(`No token amount in 1inch API response:`, priceData);
          throw new Error('Invalid API response - no destination amount');
        }

        const destinationAmount = priceData.toTokenAmount || priceData.dstAmount;
        const rate = parseFloat(destinationAmount) / parseFloat(amount);

        // Helper function to get token info from known addresses
        const getTokenInfo = (address: string, chainId: number) => {
          const lowerAddress = address.toLowerCase();
          
          // ETH/Native token
          if (address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
            return {
              address: address,
              symbol: chainId === 1 ? 'ETH' : chainId === 137 ? 'MATIC' : 'BNB',
              name: chainId === 1 ? 'Ethereum' : chainId === 137 ? 'Polygon' : 'BNB',
              decimals: 18
            };
          }
          
          // USDT
          if (lowerAddress === '0xdac17f958d2ee523a2206206994597c13d831ec7') {
            return { address, symbol: 'USDT', name: 'Tether USD', decimals: 6 };
          }
          
        // USDC - Updated with correct address
        if (lowerAddress === '0xa0b86a33e6417ea11037c5f37fe7dc5f7f80e0a5') {
          return { address, symbol: 'USDC', name: 'USD Coin', decimals: 6 };
        }          // Default fallback
          return { address, symbol: 'TOKEN', name: 'Unknown Token', decimals: 18 };
        };

        const fromTokenInfo = priceData.fromToken || getTokenInfo(fromTokenAddress, chainId);
        const toTokenInfo = priceData.toToken || getTokenInfo(toTokenAddress, chainId);

        const result: SpotPrice = {
          fromToken: {
            address: fromTokenInfo.address,
            symbol: fromTokenInfo.symbol,
            name: fromTokenInfo.name,
            decimals: fromTokenInfo.decimals,
            chainId,
            tags: [],
            isVerified: true,
          },
          toToken: {
            address: toTokenInfo.address,
            symbol: toTokenInfo.symbol,
            name: toTokenInfo.name,
            decimals: toTokenInfo.decimals,
            chainId,
            tags: [],
            isVerified: true,
          },
          fromAmount: amount,
          toAmount: destinationAmount,
          rate,
          timestamp: Date.now(),
        };

        // Cache the result
        this.setCachedData(cacheKey, result);

        // Reset rate limit delay on success
        this.rateLimitDelay = 1500;

        return result;

      } catch (error) {
        this.logger.error(`Failed to fetch spot price (attempt ${retryCount + 1}): ${error.message}`);
        
        // Log more details about the error
        if (error.response) {
          this.logger.error(`API Error Details:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
            params: error.config?.params
          });
        }
        
        // Handle rate limiting with exponential backoff
        if (error.response?.status === 429) {
          await this.handleRateLimit(error, retryCount);
          continue; // Retry the request
        }
        
        // For other errors, only retry once more
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay before retry
          continue;
        }
        
        // Final fallback after all retries
        this.logger.warn('All retries failed - returning fallback data');
        return this.getFallbackSpotPrice(fromTokenAddress, toTokenAddress, amount, chainId);
      }
    }
  }

  /**
   * Fallback spot price when API fails - simplified for local mainnet fork
   */
  private getFallbackSpotPrice(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    chainId: number
  ): SpotPrice {
    // Get token info based on known addresses for local fork
    const getTokenInfo = (address: string) => {
      const lowerAddress = address.toLowerCase();
      
      // ETH
      if (address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        return { symbol: 'ETH', name: 'Ethereum', decimals: 18, priceUsd: 3460.84 };
      }
      
      // USDC
      if (lowerAddress === '0xa0b86a33e6417ea11037c5f37fe7dc5f7f80e0a5') {
        return { symbol: 'USDC', name: 'USD Coin', decimals: 6, priceUsd: 1.0 };
      }
      
      // USDT
      if (lowerAddress === '0xdac17f958d2ee523a2206206994597c13d831ec7') {
        return { symbol: 'USDT', name: 'Tether USD', decimals: 6, priceUsd: 1.0 };
      }
      
      // Default fallback
      return { symbol: 'TOKEN', name: 'Unknown Token', decimals: 18, priceUsd: 1.0 };
    };

    const fromTokenInfo = getTokenInfo(fromTokenAddress);
    const toTokenInfo = getTokenInfo(toTokenAddress);
    
    // Calculate fallback rate based on token prices
    const rate = fromTokenInfo.priceUsd / toTokenInfo.priceUsd;
    const toAmount = (parseFloat(amount) * rate / Math.pow(10, fromTokenInfo.decimals - toTokenInfo.decimals)).toString();

    return {
      fromToken: {
        address: fromTokenAddress,
        symbol: fromTokenInfo.symbol,
        name: fromTokenInfo.name,
        decimals: fromTokenInfo.decimals,
        chainId,
        tags: [],
        isVerified: false,
      },
      toToken: {
        address: toTokenAddress,
        symbol: toTokenInfo.symbol,
        name: toTokenInfo.name,
        decimals: toTokenInfo.decimals,
        chainId,
        tags: [],
        isVerified: false,
      },
      fromAmount: amount,
      toAmount: toAmount,
      rate,
      timestamp: Date.now(),
    };
  }

  /**
   * Get multi-chain wallet balances - simplified for local fork (ETH only)
   */
  async getMultiChainBalances(address: string): Promise<WalletBalances[]> {
    // For local fork, only return Ethereum balances (1inch only supports major chains)
    if (this.isLocalFork()) {
      this.logger.debug('Using local fork - returning ETH only (1inch supported)');
      const ethBalances = await this.getWalletBalances(address, 1);
      return [ethBalances];
    }

    // For live networks, use the original multi-chain approach
    const supportedChains = [1, 137, 56]; // Ethereum, Polygon, BSC
    const promises = supportedChains.map(chainId => 
      this.getWalletBalances(address, chainId).catch(error => {
        this.logger.warn(`Failed to fetch balances for chain ${chainId}: ${error.message}`);
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter(result => result !== null);
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chainId: number): Promise<TokenMetadata[]> {
    try {
      this.logger.log(`Fetching supported tokens for chain ${chainId}`);

      const response = await this.apiClient.get(`/swap/v6.0/${chainId}/tokens`);
      const tokensData = response.data.tokens || {};

      const tokens: TokenMetadata[] = [];
      for (const [address, tokenData] of Object.entries(tokensData)) {
        const token = tokenData as any;
        tokens.push({
          address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          tags: token.tags || [],
          chainId,
          isVerified: !token.tags?.includes('RISK:unverified'),
        });
      }

      return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

    } catch (error) {
      this.logger.error(`Failed to fetch supported tokens: ${error.message}`);
      throw new HttpException(
        `Failed to fetch supported tokens: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Convert amount between tokens using 1inch rates
   */
  async convertAmount(
    fromToken: string,
    toToken: string,
    amount: string,
    chainId: number = 1
  ): Promise<{ fromAmount: string; toAmount: string; rate: number }> {
    const priceData = await this.getSpotPrice(fromToken, toToken, amount, chainId);
    
    return {
      fromAmount: priceData.fromAmount,
      toAmount: priceData.toAmount,
      rate: priceData.rate,
    };
  }

  /**
   * Health check for 1inch API
   */
  async healthCheck(): Promise<{ status: string; api1inch: boolean }> {
    try {
      await this.apiClient.get('/swap/v6.0/1/tokens');
      return { status: 'healthy', api1inch: true };
    } catch (error) {
      this.logger.error(`1inch API health check failed: ${error.message}`);
      return { status: 'unhealthy', api1inch: false };
    }
  }
}