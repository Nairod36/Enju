import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TreePine, Coins, TrendingUp, Gift } from "lucide-react";

export function AppDashboard() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-normal text-slate-900 mb-2">
          Welcome to your Forest
        </h1>
        <p className="text-slate-600">
          Manage your DeFi ecosystem and watch your forest grow
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-4xl text-slate-900 font-normal tracking-tight">
              $12,450
            </div>
            <div className="mt-2 text-slate-500 font-normal">Total Balance</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-4xl text-slate-900 font-normal tracking-tight">
              847
            </div>
            <div className="mt-2 text-slate-500 font-normal">Trees Planted</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-4xl text-slate-900 font-normal tracking-tight">
              +12.5%
            </div>
            <div className="mt-2 text-slate-500 font-normal">Yield Earned</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-4xl text-slate-900 font-normal tracking-tight">
              256
            </div>
            <div className="mt-2 text-slate-500 font-normal">Rewards</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50 rounded-2xl">
          <CardContent className="p-8">
            <h3 className="text-xl font-normal text-slate-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-11">
                Plant New Trees
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-6 h-11"
              >
                Harvest Rewards
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full border-slate-300 hover:bg-slate-100 text-slate-800 px-6 h-11"
              >
                Swap Tokens
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-8">
            <h3 className="text-xl font-normal text-slate-900 mb-4">
              Forest Health
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Ecosystem Health</span>
                  <span className="text-emerald-600 font-medium">92%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Growth Rate</span>
                  <span className="text-green-600 font-medium">+8.5%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
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
