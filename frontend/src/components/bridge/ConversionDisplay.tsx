import React from 'react';
import { ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useConversion } from '@/hooks/usePriceOracle';

interface ConversionDisplayProps {
  fromAmount: string;
  fromChain: 'ethereum' | 'near' | 'tron';
  toChain: 'ethereum' | 'near' | 'tron';
  className?: string;
}

export function ConversionDisplay({ 
  fromAmount, 
  fromChain, 
  toChain, 
  className = '' 
}: ConversionDisplayProps) {
  const conversion = useConversion(fromAmount, fromChain, toChain);

  const formatAmount = (amount: string, decimals: number = 6) => {
    const num = parseFloat(amount);
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    return num.toFixed(decimals);
  };

  const getChainSymbol = (chain: string) => {
    switch (chain) {
      case 'ethereum': return 'ETH';
      case 'near': return 'NEAR';
      case 'tron': return 'TRX';
      default: return chain.toUpperCase();
    }
  };

  const getChainColor = (chain: string) => {
    switch (chain) {
      case 'ethereum': return 'text-blue-600';
      case 'near': return 'text-green-600';
      case 'tron': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (conversion.error) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span className="text-red-700 text-sm">
          Failed to get conversion rate
        </span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-lg ${className}`}>
      {/* Conversion Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {fromAmount || '0'}
            </div>
            <div className={`text-sm font-medium ${getChainColor(fromChain)}`}>
              {getChainSymbol(fromChain)}
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-gray-400" />
          
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {conversion.isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              ) : (
                formatAmount(conversion.convertedAmount)
              )}
            </div>
            <div className={`text-sm font-medium ${getChainColor(toChain)}`}>
              {getChainSymbol(toChain)}
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        {conversion.exchangeRate > 0 && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Exchange Rate</div>
            <div className="text-sm font-medium text-gray-700">
              1 {getChainSymbol(fromChain)} = {formatAmount(conversion.exchangeRate.toString(), 4)} {getChainSymbol(toChain)}
            </div>
          </div>
        )}
      </div>

      {/* Price Source */}
      <div className="mt-3 pt-2 border-t border-gray-200">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">
            {conversion.isLoading ? 'Fetching real-time rates...' : 'Live market rates'}
          </span>
          <span className="text-gray-400">
            Updated every 30s
          </span>
        </div>
      </div>
    </div>
  );
}