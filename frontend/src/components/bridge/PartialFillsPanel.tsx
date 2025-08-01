import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ethers } from 'ethers';
import { BRIDGE_CONFIG } from '@/config/networks';

interface PartialFill {
  fillId: string;
  escrow: string;
  amount: string;
  timestamp: number;
  completed: boolean;
}

interface SwapProgress {
  swapId: string;
  totalAmount: string;
  filledAmount: string;
  remainingAmount: string;
  fillCount: number;
  completed: boolean;
  fillPercentage: number;
  fills: PartialFill[];
}

interface PartialFillsPanelProps {
  swapId: string | null;
  isVisible: boolean;
}

export function PartialFillsPanel({ swapId, isVisible }: PartialFillsPanelProps) {
  const [swapProgress, setSwapProgress] = useState<SwapProgress | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSwapProgress = async () => {
    if (!swapId) return;

    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const resolverContract = new ethers.Contract(
        BRIDGE_CONFIG.contractAddress,
        [
          'function getSwapProgress(bytes32 swapId) external view returns (uint256 totalAmount, uint256 filledAmount, uint256 remainingAmount, uint256 fillCount, bool completed, uint256 fillPercentage)',
          'function getPartialFills(bytes32 swapId) external view returns (tuple(bytes32 swapId, address escrow, uint256 amount, uint256 timestamp, bytes32 fillId)[])'
        ],
        provider
      );

      // Get swap progress
      const progress = await resolverContract.getSwapProgress(swapId);
      const partialFills = await resolverContract.getPartialFills(swapId);

      const swapProgressData: SwapProgress = {
        swapId,
        totalAmount: ethers.utils.formatEther(progress.totalAmount),
        filledAmount: ethers.utils.formatEther(progress.filledAmount),
        remainingAmount: ethers.utils.formatEther(progress.remainingAmount),
        fillCount: progress.fillCount.toNumber(),
        completed: progress.completed,
        fillPercentage: progress.fillPercentage.toNumber(),
        fills: partialFills.map((fill: any) => ({
          fillId: fill.fillId,
          escrow: fill.escrow,
          amount: ethers.utils.formatEther(fill.amount),
          timestamp: fill.timestamp.toNumber(),
          completed: false // Would need to check completion status
        }))
      };

      setSwapProgress(swapProgressData);
    } catch (error) {
      console.error('Failed to fetch swap progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPartialFill = async (fillAmount: string) => {
    if (!swapId || !window.ethereum) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      const resolverContract = new ethers.Contract(
        BRIDGE_CONFIG.contractAddress,
        [
          'function createPartialFill(bytes32 swapId, uint256 fillAmount) external payable returns (bytes32 fillId, address escrow)'
        ],
        signer
      );

      const fillAmountWei = ethers.utils.parseEther(fillAmount);
      const tx = await resolverContract.createPartialFill(swapId, fillAmountWei, {
        value: fillAmountWei,
        gasLimit: 500000
      });

      console.log('Partial fill transaction:', tx.hash);
      await tx.wait();
      
      // Refresh progress after successful fill
      setTimeout(fetchSwapProgress, 2000);
    } catch (error) {
      console.error('Failed to create partial fill:', error);
    }
  };

  useEffect(() => {
    if (isVisible && swapId) {
      fetchSwapProgress();
      // Refresh every 10 seconds
      const interval = setInterval(fetchSwapProgress, 10000);
      return () => clearInterval(interval);
    }
  }, [isVisible, swapId]);

  if (!isVisible) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧩 Partial Fills (1inch Fusion+)
            <Badge variant="secondary">Feature Available</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-muted-foreground">
            <div className="space-y-2">
              <div className="text-lg">🚀 Ready for Smart Fills!</div>
              <p className="text-sm">
                Any bridge order can benefit from partial fills - better execution and routing regardless of size!
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-800">💡 Benefits</div>
                  <ul className="mt-1 text-blue-600">
                    <li>• Faster fills</li>
                    <li>• Better prices</li>
                    <li>• Real-time progress</li>
                  </ul>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-800">📊 Example</div>
                  <div className="mt-1 text-green-600">
                    <div>Order: 0.05 ETH</div>
                    <div>Fill 1: 0.02 ETH ⚡</div>
                    <div>Fill 2: 0.03 ETH ⚡</div>
                    <div className="font-semibold">✅ Complete!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!swapId) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧩 Partial Fills Tracking
            <Badge variant="outline">Waiting for Bridge</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Complete a bridge transaction to see partial fills tracking in action!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Partial Fills Progress
          {loading && <div className="animate-spin">⏳</div>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {swapProgress ? (
          <>
            {/* Progress Overview */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {swapProgress.fillPercentage}%</span>
                <span>
                  {swapProgress.filledAmount} / {swapProgress.totalAmount} ETH
                </span>
              </div>
              <Progress value={swapProgress.fillPercentage} className="h-2" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="ml-2 font-mono">{swapProgress.remainingAmount} ETH</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fills:</span>
                  <span className="ml-2">{swapProgress.fillCount}</span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex gap-2">
              <Badge variant={swapProgress.completed ? 'default' : 'secondary'}>
                {swapProgress.completed ? '✅ Fully Filled' : '⏳ Partially Filled'}
              </Badge>
              {swapProgress.fillCount > 1 && (
                <Badge variant="outline">
                  🔄 {swapProgress.fillCount} Partial Fills
                </Badge>
              )}
            </div>

            {/* Partial Fills List */}
            {swapProgress.fills.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Partial Fills History</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {swapProgress.fills.map((fill, index) => (
                    <div key={fill.fillId} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                      <div>
                        <span className="font-mono">Fill #{index + 1}</span>
                        <span className="ml-2 text-muted-foreground">
                          {new Date(fill.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{fill.amount} ETH</span>
                        <Badge variant={fill.completed ? 'default' : 'secondary'} className="text-xs">
                          {fill.completed ? '✅' : '⏳'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Fill Buttons */}
            {!swapProgress.completed && parseFloat(swapProgress.remainingAmount) > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Quick Partial Fill</h4>
                <div className="flex gap-2 flex-wrap">
                  {[0.1, 0.5, 1.0].map(amount => {
                    const amountStr = amount.toString();
                    const remaining = parseFloat(swapProgress.remainingAmount);
                    const disabled = amount > remaining;
                    
                    return (
                      <Button
                        key={amount}
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => createPartialFill(amountStr)}
                      >
                        Fill {amountStr} ETH
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => createPartialFill(swapProgress.remainingAmount)}
                  >
                    Fill Remaining ({swapProgress.remainingAmount} ETH)
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            {loading ? 'Loading swap progress...' : 'No swap data available'}
          </div>
        )}

        <Button 
          onClick={fetchSwapProgress} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          🔄 Refresh Progress
        </Button>
      </CardContent>
    </Card>
  );
}