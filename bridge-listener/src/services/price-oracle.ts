import axios from 'axios';

export interface PriceData {
  trxToEth: number;
  ethToTrx: number;
  nearToEth: number;
  ethToNear: number;
  timestamp: number;
  source: '1inch' | 'coingecko' | 'binance' | 'cache';
}

export interface InchSpotPriceResponse {
  dstAmount: string;
  srcToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  dstToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
}

export class PriceOracle {
  private cache: Map<string, { data: PriceData; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds
  private readonly INCH_API = 'https://api.1inch.dev';
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private readonly BINANCE_API = 'https://api.binance.com/api/v3';
  
  // Token addresses for 1inch API (mainnet)
  private readonly TOKENS = {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    USDC: '0xA0b86a33E6417ea11037c5F37fE7dc5F7f80e0a5', // USDC
    TRX: '0x50327c6c5a14DCaDE707ABad2E27eB517df87AB5', // TRX on Ethereum
    NEAR: '0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4' // NEAR on Ethereum
  };

  /**
   * Get current TRX/ETH/NEAR exchange rates using 1inch Spot Price API
   */
  async getCurrentPrices(): Promise<PriceData> {
    const cacheKey = 'crypto-prices';
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() < cached.expiry) {
      return { ...cached.data, source: 'cache' };
    }

    try {
      // Try 1inch API first (most accurate for DeFi)
      const priceData = await this.fetchFrom1inch();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: priceData,
        expiry: Date.now() + this.CACHE_DURATION
      });
      
      return priceData;
    } catch (error) {
      console.warn('❌ 1inch API failed, trying CoinGecko:', error);
      
      try {
        const priceData = await this.fetchFromCoinGecko();
        
        // Cache the result
        this.cache.set(cacheKey, {
          data: priceData,
          expiry: Date.now() + this.CACHE_DURATION
        });
        
        return priceData;
      } catch (coinGeckoError) {
        console.warn('❌ CoinGecko failed, trying Binance:', coinGeckoError);
        
        try {
          const priceData = await this.fetchFromBinance();
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: priceData,
            expiry: Date.now() + this.CACHE_DURATION
          });
          
          return priceData;
        } catch (binanceError) {
          console.error('❌ All price sources failed:', binanceError);
          
          // Return cached data if available, even if expired
          if (cached) {
            console.log('⚠️ Using expired cached data');
            return { ...cached.data, source: 'cache' };
          }
          
          throw new Error('Unable to fetch price data from any source');
        }
      }
    }
  }

  /**
   * Fetch prices from 1inch Spot Price API
   */
  private async fetchFrom1inch(): Promise<PriceData> {
    const chainId = 1; // Ethereum mainnet
    const amount = '1000000000000000000'; // 1 ETH in wei

    // Get TRX/ETH rate
    const trxResponse = await axios.get(`${this.INCH_API}/price/v1.1/${chainId}/${this.TOKENS.TRX}/${this.TOKENS.ETH}`, {
      params: { amount },
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${process.env.INCH_API_KEY || ''}`,
        'Accept': 'application/json'
      }
    });

    // Get NEAR/ETH rate
    const nearResponse = await axios.get(`${this.INCH_API}/price/v1.1/${chainId}/${this.TOKENS.NEAR}/${this.TOKENS.ETH}`, {
      params: { amount },
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${process.env.INCH_API_KEY || ''}`,
        'Accept': 'application/json'
      }
    });

    // Convert responses
    const trxToEthData = trxResponse.data as InchSpotPriceResponse;
    const nearToEthData = nearResponse.data as InchSpotPriceResponse;

    // Parse amounts (1inch returns string values)
    const trxToEthAmount = parseFloat(trxToEthData.dstAmount) / Math.pow(10, trxToEthData.dstToken.decimals);
    const nearToEthAmount = parseFloat(nearToEthData.dstAmount) / Math.pow(10, nearToEthData.dstToken.decimals);

    const trxToEth = trxToEthAmount;
    const ethToTrx = 1 / trxToEthAmount;
    const nearToEth = nearToEthAmount;
    const ethToNear = 1 / nearToEthAmount;

    console.log(`📊 1inch prices: TRX/ETH=${trxToEth.toFixed(8)}, NEAR/ETH=${nearToEth.toFixed(8)}`);

    return {
      trxToEth,
      ethToTrx,
      nearToEth,
      ethToNear,
      timestamp: Date.now(),
      source: '1inch'
    };
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchFromCoinGecko(): Promise<PriceData> {
    const response = await axios.get(`${this.COINGECKO_API}/simple/price`, {
      params: {
        ids: 'tron,ethereum,near',
        vs_currencies: 'usd',
        include_24hr_change: true
      },
      timeout: 5000
    });

    const data = response.data;
    const trxUsd = data.tron?.usd;
    const ethUsd = data.ethereum?.usd;
    const nearUsd = data.near?.usd;

    if (!trxUsd || !ethUsd || !nearUsd) {
      throw new Error('Invalid response from CoinGecko');
    }

    const trxToEth = trxUsd / ethUsd;
    const ethToTrx = ethUsd / trxUsd;
    const nearToEth = nearUsd / ethUsd;
    const ethToNear = ethUsd / nearUsd;

    console.log(`📊 CoinGecko prices: TRX=$${trxUsd}, ETH=$${ethUsd}, NEAR=$${nearUsd}`);
    console.log(`📊 Rates: TRX/ETH=${trxToEth.toFixed(8)}, NEAR/ETH=${nearToEth.toFixed(8)}`);

    return {
      trxToEth,
      ethToTrx,
      nearToEth,
      ethToNear,
      timestamp: Date.now(),
      source: 'coingecko'
    };
  }

  /**
   * Fetch prices from Binance API (backup)
   */
  private async fetchFromBinance(): Promise<PriceData> {
    // Get TRX/USDT, ETH/USDT, and NEAR/USDT prices
    const [trxResponse, ethResponse, nearResponse] = await Promise.all([
      axios.get(`${this.BINANCE_API}/ticker/price?symbol=TRXUSDT`, { timeout: 5000 }),
      axios.get(`${this.BINANCE_API}/ticker/price?symbol=ETHUSDT`, { timeout: 5000 }),
      axios.get(`${this.BINANCE_API}/ticker/price?symbol=NEARUSDT`, { timeout: 5000 })
    ]);

    const trxUsd = parseFloat(trxResponse.data.price);
    const ethUsd = parseFloat(ethResponse.data.price);
    const nearUsd = parseFloat(nearResponse.data.price);

    if (!trxUsd || !ethUsd || !nearUsd) {
      throw new Error('Invalid response from Binance');
    }

    const trxToEth = trxUsd / ethUsd;
    const ethToTrx = ethUsd / trxUsd;
    const nearToEth = nearUsd / ethUsd;
    const ethToNear = ethUsd / nearUsd;

    console.log(`📊 Binance prices: TRX=$${trxUsd}, ETH=$${ethUsd}, NEAR=$${nearUsd}`);
    console.log(`📊 Rates: TRX/ETH=${trxToEth.toFixed(8)}, NEAR/ETH=${nearToEth.toFixed(8)}`);

    return {
      trxToEth,
      ethToTrx,
      nearToEth,
      ethToNear,
      timestamp: Date.now(),
      source: 'binance'
    };
  }

  /**
   * Convert TRX amount to ETH equivalent
   */
  async convertTrxToEth(trxAmount: string): Promise<string> {
    const prices = await this.getCurrentPrices();
    const trxAmountNum = parseFloat(trxAmount);
    const ethAmount = trxAmountNum * prices.trxToEth;
    
    return ethAmount.toFixed(18); // Return with 18 decimals for precision
  }

  /**
   * Convert ETH amount to TRX equivalent  
   */
  async convertEthToTrx(ethAmount: string): Promise<string> {
    const prices = await this.getCurrentPrices();
    const ethAmountNum = parseFloat(ethAmount);
    const trxAmount = ethAmountNum * prices.ethToTrx;
    
    return trxAmount.toFixed(6); // Return with 6 decimals for TRX
  }

  /**
   * Convert NEAR amount to ETH equivalent
   */
  async convertNearToEth(nearAmount: string): Promise<string> {
    const prices = await this.getCurrentPrices();
    const nearAmountNum = parseFloat(nearAmount);
    
    // Apply a slight conservative factor to avoid giving too much ETH
    const CONSERVATIVE_FACTOR = 0.98; // Give 2% less ETH to be safe
    const ethAmount = nearAmountNum * prices.nearToEth * CONSERVATIVE_FACTOR;
    
    console.log(`💱 NEAR → ETH Conversion Details:`);
    console.log(`   Input: ${nearAmount} NEAR`);
    console.log(`   Rate: ${prices.nearToEth.toFixed(8)} ETH per NEAR`);
    console.log(`   Raw conversion: ${(nearAmountNum * prices.nearToEth).toFixed(8)} ETH`);
    console.log(`   Conservative factor: ${CONSERVATIVE_FACTOR} (${((1-CONSERVATIVE_FACTOR)*100).toFixed(1)}% reduction)`);
    console.log(`   Final amount: ${ethAmount.toFixed(8)} ETH`);
    
    return ethAmount.toFixed(18); // Return with 18 decimals for precision
  }

  /**
   * Convert ETH amount to NEAR equivalent  
   */
  async convertEthToNear(ethAmount: string): Promise<string> {
    const prices = await this.getCurrentPrices();
    const ethAmountNum = parseFloat(ethAmount);
    const nearAmount = ethAmountNum * prices.ethToNear;
    
    return nearAmount.toFixed(8); // Return with 8 decimals for NEAR
  }

  /**
   * Calculate bridge fees (0.3% fee example)
   */
  async calculateBridgeFee(amount: string, fromToken: 'TRX' | 'ETH' | 'NEAR'): Promise<{
    originalAmount: string;
    fee: string;
    netAmount: string;
    feePercentage: number;
  }> {
    const FEE_PERCENTAGE = 0.003; // 0.3% fee
    const originalAmountNum = parseFloat(amount);
    const feeAmount = originalAmountNum * FEE_PERCENTAGE;
    const netAmount = originalAmountNum - feeAmount;

    const decimals = fromToken === 'ETH' ? 18 : fromToken === 'TRX' ? 6 : 8;

    return {
      originalAmount: amount,
      fee: feeAmount.toFixed(decimals),
      netAmount: netAmount.toFixed(decimals),
      feePercentage: FEE_PERCENTAGE * 100
    };
  }

  /**
   * Get price statistics
   */
  getPriceStats(): { cacheSize: number; lastUpdate?: number } {
    const cached = this.cache.get('crypto-prices');
    return {
      cacheSize: this.cache.size,
      lastUpdate: cached?.data.timestamp
    };
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Price cache cleared');
  }
}