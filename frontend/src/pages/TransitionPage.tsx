import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import FluidLogo from "../components/FluidLogo";

export function TransitionPage() {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          setTimeout(() => {
            setShowApp(true);
            setTimeout(() => navigate({ to: "/app" }), 800);
          }, 1000);
          return 100;
        }
        return prev + 1.5;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div
      className={`fixed inset-0 transition-all duration-1000 ${
        showApp ? "opacity-0 scale-110" : "opacity-100 scale-100"
      }`}
    >
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-white to-emerald-50/40" />
      
      {/* Subtle animated background elements */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 right-20 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-slate-800">
        {/* Logo with enhanced animations */}
        <div className="mb-16 relative">
          {/* Glow rings */}
          <div
            className={`absolute inset-0 transition-all duration-1000 ${
              isComplete ? "scale-150 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="absolute -inset-8 border border-emerald-400/30 rounded-full animate-ping" />
            <div className="absolute -inset-12 border border-emerald-400/20 rounded-full animate-ping delay-500" />
            <div className="absolute -inset-16 border border-emerald-400/10 rounded-full animate-ping delay-1000" />
          </div>

          {/* Background glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400/20 to-emerald-600/20 rounded-full blur-xl animate-pulse" />

          {/* Logo container */}
          <div
            className={`relative transform transition-all duration-1000 ${
              isComplete ? "scale-125 rotate-12" : "scale-100 rotate-0"
            }`}
          >
            <div className="scale-150">
              <FluidLogo />
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center mb-8">
          <h2
            className={`text-2xl font-normal transition-all duration-500 ${
              isComplete ? "text-emerald-700" : "text-slate-900"
            }`}
          >
            {isComplete ? "Ready!" : "Loading..."}
          </h2>
        </div>

        {/* Progress bar */}
        <div className="w-80 max-w-sm">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete ? "bg-emerald-500" : "bg-emerald-600"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600 mt-3">
            <span>Initializing...</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Completion message */}
        {isComplete && (
          <div className="mt-8 animate-fade-in">
            <p className="text-emerald-700 text-lg font-normal">
              Welcome to your DeFi Forest
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
