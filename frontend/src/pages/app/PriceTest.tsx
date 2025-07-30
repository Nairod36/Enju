import React, { useState } from 'react';
import { ConversionDisplay } from '@/components/bridge/ConversionDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PriceTest() {
  const [amount, setAmount] = useState('1');
  const [fromChain, setFromChain] = useState<'ethereum' | 'near' | 'tron'>('ethereum');
  const [toChain, setToChain] = useState<'ethereum' | 'near' | 'tron'>('near');

  const chainOptions = [
    { value: 'ethereum', label: 'Ethereum (ETH)' },
    { value: 'near', label: 'NEAR Protocol (NEAR)' },
    { value: 'tron', label: 'TRON (TRX)' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔄 Price Oracle Test
          </h1>
          <p className="text-gray-600">
            Test real-time price conversions between ETH, NEAR, and TRON
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Conversion Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                step="0.000001"
                min="0"
              />
            </div>

            {/* From Chain */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Chain</label>
              <Select value={fromChain} onValueChange={(value: any) => setFromChain(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source chain" />
                </SelectTrigger>
                <SelectContent>
                  {chainOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Chain */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Chain</label>
              <Select value={toChain} onValueChange={(value: any) => setToChain(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target chain" />
                </SelectTrigger>
                <SelectContent>
                  {chainOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Quick Amounts</label>
            <div className="flex gap-2 flex-wrap">
              {['0.001', '0.01', '0.1', '1', '10', '100'].map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(quickAmount)}
                  className={amount === quickAmount ? 'bg-blue-50 border-blue-300' : ''}
                >
                  {quickAmount}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversion Display */}
        <ConversionDisplay
          fromAmount={amount}
          fromChain={fromChain}
          toChain={toChain}
        />

        {/* Additional Test Cases */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Common Conversions</h2>
          <div className="space-y-4">
            <ConversionDisplay
              fromAmount="1"
              fromChain="ethereum"
              toChain="near"
            />
            <ConversionDisplay
              fromAmount="1"
              fromChain="ethereum"
              toChain="tron"
            />
            <ConversionDisplay
              fromAmount="100"
              fromChain="near"
              toChain="ethereum"
            />
            <ConversionDisplay
              fromAmount="1000"
              fromChain="tron"
              toChain="ethereum"
            />
          </div>
        </div>

        {/* API Status */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">API Status</h2>
          <div className="text-sm text-gray-600">
            <p>• Bridge Listener API: <code>http://localhost:3001</code></p>
            <p>• Price endpoint: <code>/api/prices</code></p>
            <p>• Convert endpoint: <code>/api/convert</code></p>
            <p>• Update frequency: Every 30 seconds</p>
            <p>• Data source: CoinGecko (primary), Binance (fallback)</p>
          </div>
        </div>
      </div>
    </div>
  );
}