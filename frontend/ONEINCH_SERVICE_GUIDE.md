# Updated OneInchService Implementation Guide

## Overview

The One3. Add it to your `.env` file as `VITE_1INCH_API_KEY`nchService has been completely rewritten based on the 1inch API v6.1 specification, following the pattern from the provided Node.js implementation. This new version provides better error handling, proper TypeScript types, and improved API integration.

## Key Improvements

### 1. **API Version Upgrade**
- Upgraded from v6.0 to v6.1
- Better endpoint structure and response handling
- Improved error messages and status codes

### 2. **Enhanced Type Safety**
```typescript
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
```

### 3. **Centralized API Calls**
```typescript
private async call1inchAPI<T>(
  endpointPath: string,
  queryParams: Record<string, string>
): Promise<T>
```

### 4. **Utility Methods**
- `checkAllowance()`: Check if approval is sufficient
- `buildQueryURL()`: Consistent URL building
- Better error handling and logging

## Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```bash
# Required: Get from https://portal.1inch.dev/
VITE_1INCH_API_KEY=your_api_key_here

# Optional: Custom RPC endpoint
VITE_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
```

### API Key Setup

1. Visit [1inch Developer Portal](https://portal.1inch.dev/)
2. Create an account and verify your email
3. Generate a new API key
4. Add it to your `.env` file as `VITE_ONEINCH_API_KEY`

## Usage Examples

### Basic Quote
```typescript
const quote = await oneInchService.getQuote({
  fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  toTokenAddress: '0xA0b86a33E6441e68B7f98b88e9D7b04eF4703Ee',   // USDC
  amount: '1000000000000000000', // 1 ETH in wei
  fromAddress: '0x...', // User's wallet address
  slippage: 1, // 1% slippage
});
```

### Check Allowance
```typescript
const isAllowanceSufficient = await oneInchService.checkAllowance(
  tokenAddress,
  walletAddress,
  requiredAmount
);
```

### Get Approval Transaction
```typescript
const approvalTx = await oneInchService.getApprovalTransaction(
  tokenAddress,
  amount // Optional: specific amount, or unlimited if not provided
);
```

### Execute Swap
```typescript
const swapTx = await oneInchService.getSwapTransaction({
  fromTokenAddress: '0x...',
  toTokenAddress: '0x...',
  amount: '1000000',
  fromAddress: walletAddress,
  slippage: 1,
  disableEstimate: false,
  allowPartialFill: false,
});
```

## Error Handling

The service now provides detailed error messages:

```typescript
try {
  const quote = await oneInchService.getQuote(params);
} catch (error) {
  if (error.message.includes('insufficient liquidity')) {
    // Handle liquidity issues
  } else if (error.message.includes('401')) {
    // Handle authentication issues
  } else {
    // Handle other errors
  }
}
```

## Integration with React Component

The IntentSwap component has been updated to use the new service methods:

```typescript
// Check if approval is needed (simplified)
const isAllowanceSufficient = await oneInchService.checkAllowance(
  tokenAddress,
  walletAddress,
  amount
);

setState(prev => ({ 
  ...prev, 
  isApprovalNeeded: !isAllowanceSufficient 
}));
```

## Network Error Resolution

With a valid API key, the service should resolve the previous "NetworkError when attempting to fetch resource" issues:

1. **Authentication**: API key provides proper authentication
2. **Rate Limits**: Higher rate limits with authenticated requests
3. **CORS**: Proper headers and authentication bypass CORS issues
4. **API Version**: v6.1 has better stability and error handling

## Testing

### Without API Key
- Service will attempt calls but may fail with authentication errors
- Fallback to popular tokens list for `getTokens()`
- Clear error messages for debugging

### With API Key
- Full functionality with real-time data
- Access to complete token list (500+ tokens)
- Production-ready swap execution

## Troubleshooting

### Common Issues

1. **"401 Unauthorized"**
   - Check if API key is correctly set in `.env`
   - Verify API key is valid on 1inch portal

2. **"Rate limit exceeded"**
   - Wait before making more requests
   - Consider implementing request throttling

3. **"Insufficient liquidity"**
   - Try different token pairs
   - Reduce swap amount
   - Increase slippage tolerance

### Debug Mode

Enable detailed logging by checking browser console:
```typescript
console.log('1inch API call:', { endpoint, params, response });
```

## Next Steps

1. **Test with API Key**: Add your API key and test the functionality
2. **Error Handling**: Implement user-friendly error messages
3. **Loading States**: Add proper loading indicators
4. **Transaction Monitoring**: Implement transaction status tracking
5. **Gas Optimization**: Add gas estimation and optimization features

This implementation provides a solid foundation for DeFi token swapping with proper error handling, type safety, and integration with the 1inch v6.1 API.
