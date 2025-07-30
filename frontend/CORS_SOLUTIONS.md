# CORS Solutions for 1inch API Integration

## Understanding CORS Issues

CORS (Cross-Origin Resource Sharing) issues occur when:
- Frontend (http://localhost:5174) tries to call external API (https://api.1inch.dev)
- Browser blocks the request due to different origins
- External API doesn't include proper CORS headers

## Solution 1: Enhanced Frontend Configuration ✅ (Implemented)

### What was done:
```typescript
// In oneInchService.ts - call1inchAPI method
const response = await fetch(url, {
  method: 'GET',
  headers: this.getHeaders(),
  mode: 'cors', // Explicitly set CORS mode
  credentials: 'omit', // Don't send cookies/credentials
});
```

### Benefits:
- Quick implementation
- No backend changes needed
- Works with authenticated API calls

## Solution 2: Vite Development Proxy ✅ (Implemented)

### What was done:
```typescript
// In vite.config.ts
server: {
  proxy: {
    '/api/1inch': {
      target: 'https://api.1inch.dev',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/1inch/, ''),
      headers: {
        'Origin': 'https://api.1inch.dev',
      },
    },
  },
}

// In oneInchService.ts
const INCH_API_BASE_URL = import.meta.env.DEV 
  ? '/api/1inch/swap/v6.1' // Use proxy in development
  : 'https://api.1inch.dev/swap/v6.1'; // Direct API in production
```

### Benefits:
- No CORS issues in development
- Seamless API calls during development
- Production builds use direct API calls

### How it works:
1. **Development**: `localhost:5174/api/1inch/swap/v6.1/1/quote` → proxied to → `api.1inch.dev/swap/v6.1/1/quote`
2. **Production**: Direct calls to `api.1inch.dev`

## Solution 3: Backend Proxy (Production Ready) ✅ (Created)

### What was created:
- `backend/src/oneinch-proxy/oneinch-proxy.controller.ts`
- `backend/src/oneinch-proxy/oneinch-proxy.module.ts`

### Endpoints created:
```
GET /api/1inch/1/tokens
GET /api/1inch/1/quote
GET /api/1inch/1/swap
GET /api/1inch/1/approve/allowance
GET /api/1inch/1/approve/transaction
```

### To use backend proxy:

1. **Add to your backend .env:**
```bash
ONEINCH_API_KEY=bltXi06txZPWLfDVH1Q4MtxB5t4Nzlq3
```

2. **Update app.module.ts:**
```typescript
import { OneInchProxyModule } from './oneinch-proxy/oneinch-proxy.module';

@Module({
  imports: [
    // ... other modules
    OneInchProxyModule,
  ],
})
export class AppModule {}
```

3. **Update frontend service to use backend:**
```typescript
const INCH_API_BASE_URL = import.meta.env.DEV 
  ? '/api/1inch/swap/v6.1' // Vite proxy
  : 'http://localhost:3000/api/1inch'; // Your backend
```

## Solution 4: Browser Extension Workaround

For development only, you can disable CORS in Chrome:
```bash
# Start Chrome with disabled security (DEVELOPMENT ONLY)
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

⚠️ **Warning**: Never use this in production or with real data!

## Recommended Implementation Strategy

### Phase 1: Development (Current)
- ✅ Use Vite proxy (`vite.config.ts` configured)
- ✅ Enhanced fetch calls with CORS headers
- ✅ API key properly configured

### Phase 2: Production Ready
```typescript
// In oneInchService.ts - update base URL logic
const INCH_API_BASE_URL = import.meta.env.PROD 
  ? `${window.location.origin}/api/1inch` // Use your backend in production
  : '/api/1inch/swap/v6.1'; // Use Vite proxy in development
```

### Phase 3: Scale to Production
- Deploy backend proxy endpoints
- Configure production environment variables
- Set up proper error handling and rate limiting

## Testing Your CORS Solution

### 1. Check if API key is loaded:
Open browser console and look for:
```
✅ "1inch API key loaded successfully"
❌ "No 1inch API key found. Set VITE_1INCH_API_KEY in your .env file"
```

### 2. Test API calls:
```typescript
// Open browser console and test
const response = await oneInchService.getTokens();
console.log('Tokens loaded:', response.length);
```

### 3. Check network tab:
- Look for `/api/1inch/` requests (proxied)
- Should return 200 status codes
- No CORS error messages

## Current Status

✅ **Implemented Solutions:**
1. Enhanced fetch calls with CORS headers
2. Vite development proxy configuration  
3. Environment-based URL switching
4. Backend proxy controller (ready to use)

✅ **API Key Configuration:**
- Using `VITE_1INCH_API_KEY` from your `.env`
- Proper Authorization header injection
- Console logging for verification

## Next Steps

1. **Test Current Setup**: Start development server and test swap functionality
2. **Monitor Console**: Check for API key loading and any CORS errors
3. **Production Planning**: Decide between direct API calls or backend proxy for production

The current implementation should resolve CORS issues for development. For production, consider using the backend proxy for additional security and rate limiting control.
