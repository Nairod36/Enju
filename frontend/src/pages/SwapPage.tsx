import { IntentSwap } from "@/components/bridge/IntentSwap";
import { ModernBridge } from "@/components/bridge/ModernBridge";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Zap } from "lucide-react";

export function SwapPage() {
  const [activeTab, setActiveTab] = useState<'swap' | 'bridge'>('swap');
  const [swapHistory, setSwapHistory] = useState<any[]>([]);

  const handleSwapSuccess = (swapData: any) => {
    console.log('Swap successful:', swapData);
    setSwapHistory(prev => [swapData, ...prev.slice(0, 4)]); // Keep last 5 swaps
  };

  const handleBridgeSuccess = (bridgeData: any) => {
    console.log('Bridge successful:', bridgeData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Enju DeFi Hub
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience seamless token swaps and cross-chain bridging powered by 1inch Fusion and cutting-edge DeFi protocols
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg border">
            <Button
              variant={activeTab === 'swap' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('swap')}
              className="px-6 py-2 rounded-md font-semibold"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Token Swap
            </Button>
            <Button
              variant={activeTab === 'bridge' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('bridge')}
              className="px-6 py-2 rounded-md font-semibold"
            >
              <Zap className="w-4 h-4 mr-2" />
              Cross-Chain Bridge
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Component */}
            <div className="lg:col-span-2">
              {activeTab === 'swap' ? (
                <IntentSwap onSwapSuccess={handleSwapSuccess} />
              ) : (
                <ModernBridge onBridgeSuccess={handleBridgeSuccess} />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Features */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {activeTab === 'swap' ? 'Swap Features' : 'Bridge Features'}
                  </h3>
                  <div className="space-y-3">
                    {activeTab === 'swap' ? (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Best Rates</p>
                            <p className="text-xs text-gray-600">Aggregated from 100+ DEXs</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Low Slippage</p>
                            <p className="text-xs text-gray-600">Optimized routing algorithms</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Fast Execution</p>
                            <p className="text-xs text-gray-600">1inch Fusion Protocol</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Secure HTLC</p>
                            <p className="text-xs text-gray-600">Hash Time Locked Contracts</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Cross-Chain</p>
                            <p className="text-xs text-gray-600">Ethereum ↔ NEAR Protocol</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-sm">Fast Settlement</p>
                            <p className="text-xs text-gray-600">~45 second completion</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              {activeTab === 'swap' && swapHistory.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800">
                      Recent Swaps
                    </h3>
                    <div className="space-y-3">
                      {swapHistory.map((swap, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {swap.fromToken.logoURI && (
                                <img
                                  src={swap.fromToken.logoURI}
                                  alt={swap.fromToken.symbol}
                                  className="w-5 h-5 rounded-full"
                                />
                              )}
                              <span className="font-medium text-sm">
                                {parseFloat(swap.fromAmount).toFixed(4)} {swap.fromToken.symbol}
                              </span>
                            </div>
                            <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                            <div className="flex items-center gap-2">
                              {swap.toToken.logoURI && (
                                <img
                                  src={swap.toToken.logoURI}
                                  alt={swap.toToken.symbol}
                                  className="w-5 h-5 rounded-full"
                                />
                              )}
                              <span className="font-medium text-sm">
                                {parseFloat(swap.toAmount).toFixed(4)} {swap.toToken.symbol}
                              </span>
                            </div>
                          </div>
                          {swap.txHash && (
                            <div className="mt-2">
                              <a
                                href={`https://etherscan.io/tx/${swap.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 font-mono"
                              >
                                {swap.txHash.substring(0, 16)}...
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Help & Support */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Help & Support
                  </h3>
                  <div className="space-y-2">
                    <a
                      href="https://docs.1inch.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800"
                    >
                      📚 1inch Documentation
                    </a>
                    <a
                      href="https://help.1inch.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800"
                    >
                      💬 Support Center
                    </a>
                    <a
                      href="https://discord.gg/1inch"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800"
                    >
                      🎮 Discord Community
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Built with ❤️ using React, 1inch Fusion, and modern DeFi protocols
          </p>
        </div>
      </div>
    </div>
  );
}
