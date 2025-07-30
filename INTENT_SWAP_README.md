# IntentSwap Component

A modern, user-friendly token swap interface built with React and integrated with the 1inch Fusion API. Inspired by the ModernBridge component and the Orbiter Finance interface design.

## Features

### 🚀 Core Functionality
- **Token Swapping**: Seamlessly swap between ERC-20 tokens on Ethereum
- **Best Price Aggregation**: Leverages 1inch's aggregation across 100+ DEXs
- **Real-time Quotes**: Live price updates with minimal latency
- **Slippage Protection**: Configurable slippage tolerance (0.5% - 5%)
- **Gas Optimization**: Intelligent gas estimation and optimization

### 💡 User Experience
- **Modern UI**: Clean, intuitive interface inspired by leading DeFi platforms
- **Token Selection**: Easy-to-use token picker with popular tokens
- **Transaction History**: Track recent swaps with transaction links
- **Error Handling**: Clear error messages and recovery suggestions
- **Loading States**: Smooth loading animations and progress indicators

### 🔧 Technical Features
- **TypeScript Support**: Full type safety and IntelliSense
- **Wagmi Integration**: Seamless wallet connection and transaction handling
- **Ethers.js**: Robust blockchain interaction layer
- **Rate Limiting**: Respects API rate limits with intelligent queuing
- **Error Recovery**: Automatic retry logic and fallback mechanisms

## Installation

```bash
# The component is already integrated into the project
# Navigate to the swap page at /swap
```

## Usage

### Basic Implementation

```tsx
import { IntentSwap } from '@/components/bridge/IntentSwap';

function MyPage() {
  const handleSwapSuccess = (swapData: any) => {
    console.log('Swap completed:', swapData);
    // Handle successful swap (e.g., update UI, show notification)
  };

  return (
    <IntentSwap onSwapSuccess={handleSwapSuccess} />
  );
}
```

### Advanced Usage with Custom Configuration

```tsx
import { IntentSwap } from '@/components/bridge/IntentSwap';
import { ONEINCH_CONFIG } from '@/config/oneInch';

function AdvancedSwapPage() {
  const handleSwapSuccess = (swapData: any) => {
    // Custom success handling
    analytics.track('swap_completed', {
      fromToken: swapData.fromToken.symbol,
      toToken: swapData.toToken.symbol,
      amount: swapData.fromAmount,
      txHash: swapData.txHash,
    });
  };

  return (
    <div className="max-w-md mx-auto">
      <IntentSwap 
        onSwapSuccess={handleSwapSuccess}
      />
    </div>
  );
}
```

## API Integration

### 1inch Fusion API Endpoints

The component integrates with the following 1inch API endpoints:

- **GET /swap/v6.0/{chainId}/tokens** - Fetch available tokens
- **GET /swap/v6.0/{chainId}/quote** - Get swap quotes
- **GET /swap/v6.0/{chainId}/swap** - Get swap transaction data
- **GET /swap/v6.0/{chainId}/approve/allowance** - Check token allowance
- **GET /swap/v6.0/{chainId}/approve/transaction** - Get approval transaction

### Configuration

The API configuration is centralized in `/src/config/oneInch.ts`:

```typescript
export const ONEINCH_CONFIG = {
  apiBaseUrl: 'https://api.1inch.dev',
  defaultSlippage: 1, // 1%
  slippageOptions: [0.5, 1, 2.5, 5],
  // ... other settings
};
```

## Component Architecture

```
IntentSwap.tsx
├── State Management
│   ├── SwapState interface
│   ├── Token selection
│   ├── Amount inputs
│   └── Transaction status
├── API Integration
│   ├── Quote fetching
│   ├── Approval checking
│   ├── Transaction building
│   └── Error handling
├── UI Components
│   ├── Token selector modal
│   ├── Settings panel
│   ├── Transaction button
│   └── Status indicators
└── Hooks Integration
    ├── useAccount (wagmi)
    ├── useEffect (quotes)
    └── useCallback (actions)
```

## Supported Features

### ✅ Currently Implemented
- [x] Token swapping on Ethereum
- [x] Real-time price quotes
- [x] Token approval flow
- [x] Slippage configuration
- [x] Error handling
- [x] Transaction tracking
- [x] Modern UI/UX
- [x] TypeScript support

### 🚧 Future Enhancements
- [ ] Multi-chain support (Polygon, BSC, Arbitrum)
- [ ] Price impact warnings
- [ ] MEV protection
- [ ] Limit orders
- [ ] DCA (Dollar Cost Averaging)
- [ ] Portfolio integration
- [ ] Advanced charting

## Error Handling

The component includes comprehensive error handling for:

- **Network Issues**: Automatic retry with exponential backoff
- **Insufficient Balance**: Clear user feedback and suggested actions
- **Slippage Exceeded**: Automatic slippage adjustment suggestions
- **Token Not Found**: Fallback to popular token list
- **Gas Estimation Failures**: Manual gas limit options
- **Transaction Failures**: Detailed error messages and recovery steps

## Performance Optimizations

- **Debounced Inputs**: 500ms debounce for amount inputs
- **Cached Quotes**: 10-second quote caching to reduce API calls
- **Lazy Loading**: Token list loaded on demand
- **Optimistic Updates**: Immediate UI feedback before confirmation
- **Gas Optimization**: 20% buffer for gas estimation accuracy

## Security Considerations

- **Input Validation**: All user inputs are validated and sanitized
- **Approval Limits**: Users can set specific approval amounts
- **Transaction Simulation**: Preview transactions before execution
- **Slippage Protection**: Configurable maximum slippage tolerance
- **MEV Awareness**: Uses 1inch Fusion for MEV protection

## Troubleshooting

### Common Issues

1. **"Connect Wallet" not working**
   - Ensure MetaMask is installed and unlocked
   - Check if you're on the correct network (Ethereum mainnet)

2. **Quotes not loading**
   - Check internet connection
   - Verify token addresses are valid
   - Try refreshing the page

3. **Transaction failing**
   - Increase slippage tolerance
   - Check gas price settings
   - Ensure sufficient ETH for gas fees

4. **Approval not working**
   - Clear browser cache
   - Reset MetaMask account
   - Try increasing gas limit

## Contributing

To contribute to the IntentSwap component:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This component is part of the Enju project and follows the same licensing terms.

## Support

For support and questions:
- 📖 [1inch Documentation](https://docs.1inch.io/)
- 💬 [Discord Community](https://discord.gg/1inch)
- 🐛 [GitHub Issues](https://github.com/Nairod36/Enju/issues)
