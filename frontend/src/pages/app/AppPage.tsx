import { Outlet } from "@tanstack/react-router";
import { AppHeader } from "../../components/headers/AppHeader";

export function AppPage() {
  return (
    <div className="min-h-screen text-white font-sans selection:bg-green-400/30 selection:text-white overflow-hidden">
      {/* Background with very dark green/black gradient like the landing page */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-green-950/80" />
      <div className="fixed inset-0 bg-gradient-to-tr from-green-950/30 via-transparent to-gray-950" />
      <div className="fixed inset-0 bg-gradient-to-bl from-transparent via-black/90 to-green-950/40" />

      {/* Very subtle animated background elements */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-800/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-green-800/4 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-2/3 left-2/3 w-64 h-64 bg-green-800/3 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <AppHeader />
      <main className="relative z-10 pt-32">
        <Outlet />
      </main>
    </div>
  );
}
