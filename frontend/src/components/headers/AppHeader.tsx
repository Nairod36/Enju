import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import { Wallet, User, Settings } from "lucide-react";
import FluidLogo from "../FluidLogo";

export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-white/80 to-emerald-20/40 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="bg-white/90 rounded-full px-6 py-4 flex items-center justify-between shadow-md">
          {/* Logo & Brand */}
          <Link
            to="/app"
            className="flex items-center gap-2 hover:scale-105 transition-all duration-300"
          >
            <FluidLogo />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              to="/app/forest"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Forest
            </Link>
            <Link
              to="/app/defi"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              DeFi
            </Link>
            <Link
              to="/app/rewards"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Rewards
            </Link>
            <Link
              to="/app/marketplace"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Marketplace
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-4 h-10"
            >
              <Wallet size={16} className="mr-2" />
              Connect
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
            >
              <User size={16} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
