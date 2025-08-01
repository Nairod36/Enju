import React from "react";
import { OneInchDashboard } from "../../components/dashboard/OneInchDashboard";
import { AppHeader } from "../../components/headers/AppHeader";

export function OneInchPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container px-20 py-8">
        <OneInchDashboard />
      </main>
    </div>
  );
}
