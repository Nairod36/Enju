import { Outlet } from "@tanstack/react-router";
import { AppHeader } from "../../components/headers/AppHeader";

export function AppPage() {
  return (
    <div className="min-h-screen text-slate-800 font-sans selection:bg-emerald-200/60 selection:text-slate-900">
      {/* Light backgrounds with subtle green accents */}
      <div className="fixed inset-0 bg-gradient-to-br from-white to-emerald-50/40" />

      {/* Subtle animated background elements */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <AppHeader />
      <main className="relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
