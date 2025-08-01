import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import { User, Settings } from "lucide-react";
import FluidLogo from "../FluidLogo";
import { DualWalletButton } from "../DualWalletButton";

export function AppHeader() {
  return (
    <header className="top-0 left-0 right-0 z-50 backdrop-blur">
      <div className="max-w-full mx-auto py-2">
        <div className="px-14 flex items-center justify-between border-b">
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
              to="/app"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Forest
            </Link>
            <Link
              to="/app/game"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Game
            </Link>
            <Link
              to="/app/rewards"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Rewards
            </Link>
            <Link
              to="/app/explorer"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Island Explorer
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <DualWalletButton />

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
