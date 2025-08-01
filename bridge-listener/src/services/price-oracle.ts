import axios from 'axios';

export interface PriceData {
  trxToEth: number;
  ethToTrx: number;
  nearToEth: number;
  ethToNear: number;
  timestamp: number;
  source: 'coingecko' | 'binance' | 'cache';
}

export class PriceOracle {
  private cache: Map<string, { data: PriceData; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private readonly BINANCE_API = 'https://api.binance.com/api/v3';

  /**
   * Get current TRX/ETH/NEAR exchange rates
   */
  async getCurrentPrices(): Promise<PriceData> {
    const cacheKey = 'crypto-prices';
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() < cached.expiry) {
      return { ...cached.data, source: 'cache' };
    }

    try {
      // Try CoinGecko first (more reliable)
      const priceData = await this.fetchFromCoinGecko();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: priceData,
        expiry: Date.now() + this.CACHE_DURATION
      });
      
      return priceData;
    } catch (error) {
      console.warn('❌ CoinGecko failed, trying Binance:', error);
      
      try {
        const priceData = await this.fetchFromBinance();
        
        // Cache the result
        this.cache.set(cacheKey, {
          data: priceData,
          expiry: Date.now() + this.CACHE_DURATION
        });
        
        return priceData;
      } catch (binanceError) {
        console.error('❌ Both price sources failed:', binanceError);
        
        // Return cached data if available, even if expired
        if (cached) {
          console.log('⚠️ Using expired cached data');
          return { ...cached.data, source: 'cache' };
        }
        
        throw new Error('Unable to fetch price data from any source');
      }
    }
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
    const ethAmount = nearAmountNum * prices.nearToEth;
    
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