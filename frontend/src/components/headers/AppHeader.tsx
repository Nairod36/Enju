import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import { Wallet, User, Settings } from "lucide-react";
import FluidLogo from "../FluidLogo";

export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-6 flex items-center justify-between shadow-2xl">
          {/* Logo & Brand */}
          <Link
            to="/app"
            className="flex items-center gap-2 hover:scale-105 transition-all duration-300"
          >
            <FluidLogo />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link
              to="/app/forest"
              className="text-white/70 hover:text-green-400 transition-all duration-300 hover:scale-105 px-3 py-2 rounded-lg hover:bg-white/10"
            >
              Forest
            </Link>
            <Link
              to="/app/defi"
              className="text-white/70 hover:text-green-400 transition-all duration-300 hover:scale-105 px-3 py-2 rounded-lg hover:bg-white/10"
            >
              DeFi
            </Link>
            <Link
              to="/app/rewards"
              className="text-white/70 hover:text-green-400 transition-all duration-300 hover:scale-105 px-3 py-2 rounded-lg hover:bg-white/10"
            >
              Rewards
            </Link>
            <Link
              to="/app/marketplace"
              className="text-white/70 hover:text-green-400 transition-all duration-300 hover:scale-105 px-3 py-2 rounded-lg hover:bg-white/10"
            >
              Marketplace
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-green-600/50 transition-all duration-300"
            >
              <Wallet size={16} className="mr-2" />
              Connect
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-green-400 hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              <User size={16} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-green-400 hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
