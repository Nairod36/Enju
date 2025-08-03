import { Outlet } from "@tanstack/react-router";
import { AppHeader } from "../../components/headers/AppHeader";
import { AppFooter } from "../../components/layout/AppFooter";
import { SonnerToast } from "@/components/ui/sonner";

export function AppPage() {
  return (
    <div className="flex flex-col">
      {/* Light backgrounds with subtle green accents */}
      <div className="fixed inset-0" />

      {/* Subtle animated background elements */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <AppHeader />
      <main className="h-full">
        <Outlet />
      </main>
      <AppFooter />
      <SonnerToast />
    </div>
  );
}
