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
  from: string;
  to: string;
  data: string;
  value: string;
  gasPrice: string;
  gas: string;
}

const INCH_API_BASE_URL = 'https://api.1inch.dev';
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

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  async getTokens(): Promise<Token[]> {
    try {
      const response = await fetch(
        `${INCH_API_BASE_URL}/swap/v6.0/${ETHEREUM_CHAIN_ID}/tokens`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return Object.values(data.tokens) as Token[];
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return popular tokens as fallback
      return POPULAR_TOKENS;
    }
  }

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    const queryParams = new URLSearchParams({
      src: params.fromTokenAddress,
      dst: params.toTokenAddress,
      amount: params.amount,
      includeTokensInfo: 'true',
      includeProtocols: 'true',
      includeGas: 'true',
    });

    const response = await fetch(
      `${INCH_API_BASE_URL}/swap/v6.0/${ETHEREUM_CHAIN_ID}/quote?${queryParams}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getSwapTransaction(params: SwapParams): Promise<SwapTransaction> {
    const queryParams = new URLSearchParams({
      src: params.fromTokenAddress,
      dst: params.toTokenAddress,
      amount: params.amount,
      from: params.fromAddress,
      slippage: params.slippage.toString(),
      disableEstimate: params.disableEstimate ? 'true' : 'false',
    });

    const response = await fetch(
      `${INCH_API_BASE_URL}/swap/v6.0/${ETHEREUM_CHAIN_ID}/swap?${queryParams}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.tx;
  }

  async getAllowance(tokenAddress: string, walletAddress: string): Promise<string> {
    const queryParams = new URLSearchParams({
      tokenAddress,
      walletAddress,
    });

    const response = await fetch(
      `${INCH_API_BASE_URL}/swap/v6.0/${ETHEREUM_CHAIN_ID}/approve/allowance?${queryParams}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.allowance;
  }

  async getApprovalTransaction(tokenAddress: string, amount?: string): Promise<SwapTransaction> {
    const queryParams = new URLSearchParams({
      tokenAddress,
    });

    if (amount) {
      queryParams.append('amount', amount);
    }

    const response = await fetch(
      `${INCH_API_BASE_URL}/swap/v6.0/${ETHEREUM_CHAIN_ID}/approve/transaction?${queryParams}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
}

export const oneInchService = new OneInchService();
export type { Token, SwapParams, SwapQuote, SwapTransaction };
