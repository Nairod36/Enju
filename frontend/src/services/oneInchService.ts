// Types based on 1inch API v6.1 responses
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface SwapParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  slippage: number;
  disableEstimate?: boolean;
  allowPartialFill?: boolean;
}

interface SwapQuote {
  fromToken: Token;
  toToken: Token;
  fromTokenAmount: string;
  toTokenAmount: string;
  protocols: any[];
  estimatedGas: string;
}

interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  gas?: string;
  gasPrice?: string;
}

interface AllowanceResponse {
  allowance: string;
}

interface ApprovalTransactionResponse {
  to: string;
  data: string;
  value: string;
  gas?: string;
}

interface SwapTransactionResponse {
  tx: SwapTransaction;
}

interface TokensResponse {
  tokens: Record<string, Token>;
}

// 1inch API v6.1 configuration
const INCH_API_BASE_URL = import.meta.env.DEV 
  ? '/api/1inch/swap/v6.1' // Use proxy in development
  : 'https://api.1inch.dev/swap/v6.1'; // Direct API in production
const ETHEREUM_CHAIN_ID = 1;

// Popular tokens on Ethereum
export const POPULAR_TOKENS: Token[] = [
  {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
  },
  {
    address: '0xA0b86a33E6441e68B7f98b88e9D7b04eF4703Ee',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://tokens.1inch.io/0xa0b86a33e6441e68b7f98b88e9d7b04ef4703ee.png',
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png',
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoURI: 'https://tokens.1inch.io/0x6b175474e89094c44da98b954eedeac495271d0f.png',
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    logoURI: 'https://tokens.1inch.io/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    logoURI: 'https://tokens.1inch.io/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png',
  },
];

class OneInchService {
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
    this.baseUrl = `${INCH_API_BASE_URL}/${ETHEREUM_CHAIN_ID}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      console.log('🔑 Using API key for authentication');
    } else {
      console.warn('⚠️ No API key configured - this may cause authentication errors');
    }
    
    return headers;
  }

  private buildQueryURL(path: string, params: Record<string, string>): string {
    let baseUrl: string;
    
    // Handle relative URLs (for Vite proxy) vs absolute URLs (for direct API calls)
    if (this.baseUrl.startsWith('/')) {
      // Relative URL - use current origin
      baseUrl = `${window.location.origin}${this.baseUrl}`;
    } else {
      // Absolute URL - use as is
      baseUrl = this.baseUrl;
    }
    
    const url = new URL(baseUrl + path);
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  private async call1inchAPI<T>(
    endpointPath: string,
    queryParams: Record<string, string>
  ): Promise<T> {
    const url = this.buildQueryURL(endpointPath, queryParams);
    
    console.log('🔄 1inch API call:', { endpoint: endpointPath, url, params: queryParams });

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'omit', // Don't send cookies/credentials
    });

    if (!response.ok) {
      let errorDetails: any = {};
      let body = '';
      
      try {
        body = await response.text();
        try {
          errorDetails = JSON.parse(body);
        } catch {
          // Body is not JSON, keep as text
          errorDetails = { message: body };
        }
      } catch (e) {
        body = 'Could not read response body';
      }
      
      console.error('❌ 1inch API error:', { 
        status: response.status, 
        statusText: response.statusText,
        url,
        headers: Object.fromEntries(response.headers.entries()),
        body, 
        errorDetails 
      });
      
      // Provide specific error messages based on status and response
      if (response.status === 400) {
        const errorMsg = errorDetails.description || errorDetails.message || body;
        throw new Error(`Bad Request (400): ${errorMsg}`);
      } else if (response.status === 401) {
        throw new Error(`Unauthorized (401): Invalid or missing API key`);
      } else if (response.status === 403) {
        throw new Error(`Forbidden (403): Access denied`);
      } else if (response.status === 429) {
        throw new Error(`Rate Limited (429): Too many requests`);
      } else if (response.status === 500) {
        throw new Error(`Server Error (500): 1inch API is experiencing issues`);
      } else {
        const errorMsg = errorDetails.description || errorDetails.message || body || response.statusText;
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
      }
    }

    const data = await response.json();
    console.log('✅ 1inch API response:', { endpoint: endpointPath, data });
    
    return data as T;
  }

  async getTokens(): Promise<Token[]> {
    try {
      const data = await this.call1inchAPI<TokensResponse>('/tokens', {});
      return Object.values(data.tokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return popular tokens as fallback
      return POPULAR_TOKENS;
    }
  }

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    const queryParams = {
      src: params.fromTokenAddress,
      dst: params.toTokenAddress,
      amount: params.amount,
      includeTokensInfo: 'true',
      includeProtocols: 'true',
      includeGas: 'true',
    };

    try {
      const response = await this.call1inchAPI<any>('/quote', queryParams);
      
      // Validate the response structure
      if (!response) {
        throw new Error('Empty response from 1inch API');
      }
      
      // Log the actual response structure to understand what we're getting
      console.log('📊 Raw 1inch quote response:', response);
      
      // Check for different possible field names in the response
      const toTokenAmount = response.toTokenAmount || response.toAmount || response.dstAmount || response.returnAmount;
      const fromTokenAmount = response.fromTokenAmount || response.fromAmount || response.srcAmount || params.amount;
      const estimatedGas = response.estimatedGas || response.gas || response.gasLimit || '150000';
      
      if (!toTokenAmount) {
        console.error('❌ Could not find output amount in response. Available fields:', Object.keys(response));
        throw new Error('Invalid quote response: no output amount found. Check console for details.');
      }
      
      // Build the standardized quote response
      const quote: SwapQuote = {
        fromToken: response.fromToken || { 
          address: params.fromTokenAddress, 
          symbol: 'UNKNOWN', 
          name: 'Unknown Token', 
          decimals: 18 
        },
        toToken: response.toToken || { 
          address: params.toTokenAddress, 
          symbol: 'UNKNOWN', 
          name: 'Unknown Token', 
          decimals: 18 
        },
        fromTokenAmount: fromTokenAmount,
        toTokenAmount: toTokenAmount,
        protocols: response.protocols || response.route || [],
        estimatedGas: estimatedGas,
      };
      
      console.log('✅ Standardized quote:', quote);
      return quote;
    } catch (error) {
      console.error('Error fetching quote:', error);
      throw error;
    }
  }

  async getSwapTransaction(params: SwapParams): Promise<SwapTransaction> {
    // Validate input parameters first
    console.log('🔍 Validating swap parameters:', params);
    
    if (!params.fromTokenAddress || params.fromTokenAddress === '') {
      throw new Error('Invalid fromTokenAddress: cannot be empty');
    }
    
    if (!params.toTokenAddress || params.toTokenAddress === '') {
      throw new Error('Invalid toTokenAddress: cannot be empty');
    }
    
    if (!params.amount || params.amount === '0' || params.amount === '') {
      throw new Error('Invalid amount: must be greater than 0');
    }
    
    if (!params.fromAddress || params.fromAddress === '') {
      throw new Error('Invalid fromAddress: wallet address required');
    }
    
    // Validate amount is a valid number
    try {
      const amountBigInt = BigInt(params.amount);
      if (amountBigInt <= 0) {
        throw new Error('Invalid amount: must be positive');
      }
    } catch (e) {
      throw new Error(`Invalid amount format: ${params.amount} is not a valid number`);
    }
    
    // Validate token addresses are valid Ethereum addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(params.fromTokenAddress)) {
      throw new Error(`Invalid fromTokenAddress format: ${params.fromTokenAddress}`);
    }
    
    if (!addressRegex.test(params.toTokenAddress)) {
      throw new Error(`Invalid toTokenAddress format: ${params.toTokenAddress}`);
    }
    
    if (!addressRegex.test(params.fromAddress)) {
      throw new Error(`Invalid fromAddress format: ${params.fromAddress}`);
    }
    
    // Check if trying to swap same token
    if (params.fromTokenAddress.toLowerCase() === params.toTokenAddress.toLowerCase()) {
      throw new Error('Cannot swap token to itself');
    }
    
    console.log('✅ Parameter validation passed');

    const queryParams = {
      src: params.fromTokenAddress,
      dst: params.toTokenAddress,
      amount: params.amount,
      from: params.fromAddress,
      slippage: params.slippage.toString(),
      disableEstimate: params.disableEstimate ? 'true' : 'false',
      allowPartialFill: params.allowPartialFill ? 'true' : 'false',
    };

    try {
      console.log('🔄 Getting swap transaction with params:', params);
      const data = await this.call1inchAPI<any>('/swap', queryParams);
      
      console.log('📊 Raw swap response:', data);
      
      // Check different possible response structures
      let swapTransaction: SwapTransaction;
      
      if (data.tx) {
        // Standard response structure
        swapTransaction = data.tx;
      } else if (data.to && data.data) {
        // Direct transaction object
        swapTransaction = {
          to: data.to,
          data: data.data,
          value: data.value || '0',
          gas: data.gas || data.gasLimit,
          gasPrice: data.gasPrice,
        };
      } else {
        console.error('❌ Unexpected swap response structure. Available fields:', Object.keys(data));
        throw new Error('Invalid swap response structure. Check console for details.');
      }
      
      // Validate required fields
      if (!swapTransaction.to || !swapTransaction.data) {
        console.error('❌ Missing required transaction fields:', swapTransaction);
        throw new Error('Invalid transaction data: missing to or data field');
      }
      
      console.log('✅ Parsed swap transaction:', swapTransaction);
      return swapTransaction;
      
    } catch (error) {
      console.error('❌ Error getting swap transaction:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('401')) {
        throw new Error('Authentication error: Please check your API key');
      } else if (errorMessage.includes('400')) {
        throw new Error('Invalid swap parameters: Please check token addresses and amounts');
      } else if (errorMessage.includes('429')) {
        throw new Error('Rate limit exceeded: Please wait a moment and try again');
      } else if (errorMessage.includes('insufficient liquidity')) {
        throw new Error('Insufficient liquidity for this swap');
      } else {
        throw new Error(`Swap transaction failed: ${errorMessage}`);
      }
    }
  }

  async getAllowance(tokenAddress: string, walletAddress: string): Promise<string> {
    const queryParams = {
      tokenAddress,
      walletAddress,
    };

    try {
      const data = await this.call1inchAPI<AllowanceResponse>('/approve/allowance', queryParams);
      
      // Validate the response
      if (!data || typeof data.allowance === 'undefined' || data.allowance === null) {
        console.error('Invalid allowance response:', data);
        return '0'; // Return zero allowance as safe fallback
      }
      
      return data.allowance;
    } catch (error) {
      console.error('Error getting allowance:', error);
      // Return zero allowance as safe fallback instead of throwing
      return '0';
    }
  }

  async getApprovalTransaction(
    tokenAddress: string, 
    amount?: string
  ): Promise<SwapTransaction> {
    const queryParams: Record<string, string> = {
      tokenAddress,
    };

    if (amount) {
      queryParams.amount = amount;
    }

    try {
      const data = await this.call1inchAPI<ApprovalTransactionResponse>('/approve/transaction', queryParams);
      return {
        to: data.to,
        data: data.data,
        value: data.value,
        gas: data.gas,
      };
    } catch (error) {
      console.error('Error getting approval transaction:', error);
      throw new Error('Approval transaction failed. Please try again.');
    }
  }

  // Utility method to check if allowance is sufficient
  async checkAllowance(
    tokenAddress: string, 
    walletAddress: string, 
    requiredAmount: string
  ): Promise<boolean> {
    try {
      // Validate inputs
      if (!tokenAddress || !walletAddress || !requiredAmount) {
        console.error('Invalid parameters for checkAllowance');
        return false;
      }

      const allowance = await this.getAllowance(tokenAddress, walletAddress);
      
      // Check if allowance is valid
      if (!allowance || allowance === undefined || allowance === null) {
        console.error('Invalid allowance returned from API');
        return false;
      }

      // Safely convert to BigInt with validation
      try {
        const allowanceBigInt = BigInt(allowance);
        const requiredBigInt = BigInt(requiredAmount);
        return allowanceBigInt >= requiredBigInt;
      } catch (bigIntError) {
        console.error('Error converting to BigInt:', { allowance, requiredAmount, error: bigIntError });
        return false;
      }
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  }
}

// Create service instance with API key from environment variables
const apiKey = import.meta.env.VITE_1INCH_API_KEY || null;
if (apiKey) {
  console.log('1inch API key loaded successfully');
} else {
  console.warn('No 1inch API key found. Set VITE_1INCH_API_KEY in your .env file');
}
export const oneInchService = new OneInchService(apiKey);

// Export types
export type { Token, SwapParams, SwapQuote, SwapTransaction };
