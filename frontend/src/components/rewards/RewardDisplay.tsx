import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Coins, TrendingUp, Gift } from 'lucide-react';
import { API_CONFIG, apiRequest } from '../../config/api';

interface RewardStats {
  totalRewardsEarned: number;
  currentBalance: string;
  bridgeCount: number;
}

export const RewardDisplay: React.FC = () => {
  const { address } = useAccount();
  const [rewardStats, setRewardStats] = useState<RewardStats>({
    totalRewardsEarned: 0,
    currentBalance: '0',
    bridgeCount: 0
  });
  const [loading, setLoading] = useState(false);


  const fetchRewardStats = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const [balanceResponse, statsResponse] = await Promise.all([
        apiRequest(`${API_CONFIG.BASE_URL}/rewards/balance?address=${address}`),
        apiRequest(`${API_CONFIG.BASE_URL}/rewards/stats?address=${address}`)
      ]);

      const balanceData = await balanceResponse.json();
      const statsData = await statsResponse.json();

      setRewardStats({
        currentBalance: balanceData.balance || '0',
        totalRewardsEarned: statsData.totalRewardsEarned || 0,
        bridgeCount: statsData.bridgeCount || 0
      });
    } catch (error) {
      console.error('Failed to fetch reward stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewardStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchRewardStats, 30000);
    return () => clearInterval(interval);
  }, [address]);

  const formatBalance = (balance: string): string => {
    try {
      const balanceNum = parseFloat(balance);
      if (balanceNum === 0) return '0';
      if (balanceNum < 0.0001) return '< 0.0001';
      return balanceNum.toFixed(4);
    } catch {
      return '0';
    }
  };

  if (!address) {
    return (
      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-yellow-800">
            <Coins className="w-5 h-5 mr-2" />
            Reward Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700 text-sm">
            Connect your wallet to view reward tokens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-yellow-800">
          <Coins className="w-5 h-5 mr-2" />
          Reward Tokens
          <Badge variant="secondary" className="ml-2 bg-yellow-200 text-yellow-800">
            REWARD
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-yellow-200 rounded"></div>
            <div className="h-4 bg-yellow-100 rounded"></div>
            <div className="h-4 bg-yellow-100 rounded w-3/4"></div>
          </div>
        ) : (
          <>
            {/* Current Balance */}
            <div className="flex items-center justify-between">
              <span className="text-yellow-700 font-medium">Balance:</span>
              <span className="text-xl font-bold text-yellow-900">
                {formatBalance(rewardStats.currentBalance)} REWARD
              </span>
            </div>

            {/* Total Earned */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-yellow-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                Total Earned:
              </span>
              <span className="font-semibold text-yellow-800">
                {rewardStats.totalRewardsEarned.toFixed(2)} REWARD
              </span>
            </div>

            {/* Bridge Count */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-yellow-600">
                <Gift className="w-4 h-4 mr-1" />
                Bridges Completed:
              </span>
              <span className="font-semibold text-yellow-800">
                {rewardStats.bridgeCount}
              </span>
            </div>

            {/* Reward Ratios Info */}
            <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
              <h4 className="text-xs font-semibold text-yellow-800 mb-2">
                Bridge Rewards:
              </h4>
              <div className="space-y-1 text-xs text-yellow-700">
                <div className="flex justify-between">
                  <span>1 ETH =</span>
                  <span className="font-mono">100 REWARD</span>
                </div>
                <div className="flex justify-between">
                  <span>1 NEAR =</span>
                  <span className="font-mono">0.068 REWARD</span>
                </div>
                <div className="flex justify-between">
                  <span>1 TRX =</span>
                  <span className="font-mono">0.00394 REWARD</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};