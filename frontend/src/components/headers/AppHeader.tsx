import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import { User, Settings } from "lucide-react";
import FluidLogo from "../FluidLogo";
import { DualWalletButton } from "../DualWalletButton";
import { PlayerLevelMini } from "../PlayerLevel";
import { useAuth } from "../../hooks/useAuth";

export function AppHeader() {
  const { user, isAuthenticated } = useAuth();
  
  return (
    <header className="top-0 left-0 right-0 z-50 backdrop-blur">
      <div className="max-w-full mx-auto pt-2">
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
              Bridge
            </Link>
            <Link
              to="/app/explorer"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Island Explorer
            </Link>
            <Link
              to="/docs"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Documentation
            </Link>
            <Link
              to="/app"
              className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
            >
              Support
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Affichage du niveau si l'utilisateur est connecté */}
            {isAuthenticated && user && (
              <PlayerLevelMini user={user} />
            )}
            
            <DualWalletButton />

            <Link to="/app/profile">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
              >
                <User size={16} />
              </Button>
            </Link>

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
