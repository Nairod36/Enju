import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TreePine, Coins, TrendingUp, Gift } from "lucide-react";

export function AppDashboard() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-slate-900 mb-2">
          Welcome 0x6436e197f6F5F0f25aE6F1aAB71d3642227ED672
        </h1>
        <p className="text-slate-600">
          Manage your DeFi ecosystem and watch your forest grow
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="py-4 px-8 text-center">
            <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-2xl text-slate-900 font-normal tracking-tight">
              $12,450
            </div>
            <div className="mt-1 text-slate-500 font-normal text-sm">
              Total Balance
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="py-4 px-8 text-center">
            <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-2xl text-slate-900 font-normal tracking-tight">
              847
            </div>
            <div className="mt-1 text-slate-500 font-normal text-sm">
              Trees Planted
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="py-4 px-8 text-center">
            <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-2xl text-slate-900 font-normal tracking-tight">
              +12.5%
            </div>
            <div className="mt-1 text-slate-500 font-normal text-sm">
              Yield Earned
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="py-4 px-8 text-center">
            <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="text-2xl text-slate-900 font-normal tracking-tight">
              256
            </div>
            <div className="mt-1 text-slate-500 font-normal text-sm">
              Rewards
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
