import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TreePine, Coins, TrendingUp, Gift } from "lucide-react";

export function AppDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2">
          Welcome to your Forest
        </h1>
        <p className="text-white/70">
          Manage your DeFi ecosystem and watch your forest grow
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl hover:shadow-green-800/10 transition-all duration-500 rounded-3xl hover:scale-105 hover:bg-white/10 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">
                  Total Balance
                </p>
                <p className="text-2xl font-light text-white">$12,450</p>
              </div>
              <Coins className="text-green-400" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl hover:shadow-green-800/10 transition-all duration-500 rounded-3xl hover:scale-105 hover:bg-white/10 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">
                  Trees Planted
                </p>
                <p className="text-2xl font-light text-white">847</p>
              </div>
              <TreePine className="text-green-400" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl hover:shadow-green-800/10 transition-all duration-500 rounded-3xl hover:scale-105 hover:bg-white/10 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">
                  Yield Earned
                </p>
                <p className="text-2xl font-light text-white">+12.5%</p>
              </div>
              <TrendingUp className="text-green-400" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl hover:shadow-green-800/10 transition-all duration-500 rounded-3xl hover:scale-105 hover:bg-white/10 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">Rewards</p>
                <p className="text-2xl font-light text-white">256</p>
              </div>
              <Gift className="text-yellow-400" size={32} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl rounded-3xl">
          <CardContent className="p-8">
            <h3 className="text-xl font-light text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button className="w-full rounded-2xl bg-gradient-to-br from-green-800 to-green-600 hover:from-green-700 hover:to-green-500 text-white shadow-lg hover:shadow-green-800/25 transition-all duration-300 hover:scale-105">
                Plant New Trees
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-green-600/50 transition-all duration-300 hover:scale-105"
              >
                Harvest Rewards
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
              >
                Swap Tokens
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl rounded-3xl">
          <CardContent className="p-8">
            <h3 className="text-xl font-light text-white mb-4">
              Forest Health
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">Ecosystem Health</span>
                  <span className="text-green-400 font-medium">92%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-green-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">Growth Rate</span>
                  <span className="text-green-400 font-medium">+8.5%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-green-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: "85%" }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
