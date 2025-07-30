/**
 * Fusion Swap Demo Page
 * 
 * Demonstrates the enhanced Intent Swap component with 1inch Fusion SDK integration.
 * This shows the advanced features like Dutch auction mechanics, intent-based orders,
 * and professional resolver network execution.
 */

import { IntentSwap } from "@/components/bridge/IntentSwap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Target, Clock, Shield, TrendingUp } from "lucide-react";

export function FusionSwapDemo() {
  const handleSwapSuccess = (swapData: any) => {
    console.log('🎉 Fusion Swap completed successfully:', swapData);
    
    // Show success notification
    if (swapData.orderHash) {
      alert(`Fusion order created successfully!\nOrder Hash: ${swapData.orderHash}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            1inch Fusion SDK Integration
          </h1>
          <p className="text-gray-600 text-lg">
            Intent-based swapping with Dutch auction mechanics and professional resolver network
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Swap Interface */}
          <div className="lg:col-span-2">
            <IntentSwap onSwapSuccess={handleSwapSuccess} />
          </div>

          {/* Features Panel */}
          <div className="space-y-4">
            
            {/* Fusion Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Fusion Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <div className="font-semibold text-sm">Dutch Auction</div>
                    <div className="text-xs text-gray-600">
                      Price improves over time for better execution
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-blue-600 mt-1" />
                  <div>
                    <div className="font-semibold text-sm">MEV Protection</div>
                    <div className="text-xs text-gray-600">
                      Protected from front-running and sandwich attacks
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-purple-600 mt-1" />
                  <div>
                    <div className="font-semibold text-sm">Professional Resolvers</div>
                    <div className="text-xs text-gray-600">
                      Expert market makers execute your orders
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-yellow-600 mt-1" />
                  <div>
                    <div className="font-semibold text-sm">Intent-Based</div>
                    <div className="text-xs text-gray-600">
                      Specify what you want, not how to get it
                    </div>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            {/* Execution Speeds */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Execution Presets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                
                <div className="flex items-center justify-between">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Fast
                  </span>
                  <span className="text-xs text-gray-600">Higher fees, quick execution</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                    Medium
                  </span>
                  <span className="text-xs text-gray-600">Balanced speed & cost</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Slow
                  </span>
                  <span className="text-xs text-gray-600">Lower fees, patient execution</span>
                </div>
                
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Why Use Fusion?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <div>• Better prices through Dutch auctions</div>
                <div>• No gas fees for failed transactions</div>
                <div>• Professional market maker execution</div>
                <div>• MEV protection built-in</div>
                <div>• Partial fill support</div>
                <div>• Advanced order types</div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            This implementation demonstrates the 1inch Fusion SDK integration with advanced intent-based swapping.
          </p>
          <p>
            Built with React, TypeScript, and the latest 1inch Fusion Protocol features.
          </p>
        </div>

      </div>
    </div>
  );
}
