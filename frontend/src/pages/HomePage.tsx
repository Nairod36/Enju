import { useState } from "react";
import { ArrowRight, TreePine } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FluidLogo from "@/components/FluidLogo";

export default function HomePage() {
  const [transactionHash, setTransactionHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [signedMsg, setSignedMsg] = useState("");
  const [balance, setBalance] = useState("");

  const receiveHash = (hash: `0x${string}`) => {
    setTransactionHash(hash);
  };

  const receiveSignedMsg = (signedMsg: string) => {
    setSignedMsg(signedMsg);
  };

  const receivebalance = (balance: string) => {
    setBalance(balance);
  };

  return (
    <div className="relative min-h-screen text-white font-sans selection:bg-emerald-400/30 selection:text-white overflow-hidden">
      {/* Background with very dark green/black gradient like the reference */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-green-950/80" />
      <div className="fixed inset-0 bg-gradient-to-tr from-green-950/30 via-transparent to-gray-950" />
      <div className="fixed inset-0 bg-gradient-to-bl from-transparent via-black/90 to-green-950/40" />

      {/* Very subtle animated background elements */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-800/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-green-800/4 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-2/3 left-2/3 w-64 h-64 bg-green-800/3 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Minimal texture overlay */}
      {/* <div className="fixed inset-0 opacity-[0.015] bg-[url('data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.2"%3E%3Ccircle cx="5" cy="5" r="0.5"/%3E%3Ccircle cx="15" cy="5" r="0.5"/%3E%3Ccircle cx="25" cy="5" r="0.5"/%3E%3Ccircle cx="35" cy="5" r="0.5"/%3E%3Ccircle cx="5" cy="15" r="0.5"/%3E%3Ccircle cx="15" cy="15" r="0.5"/%3E%3Ccircle cx="25" cy="15" r="0.5"/%3E%3Ccircle cx="35" cy="15" r="0.5"/%3E%3Ccircle cx="5" cy="25" r="0.5"/%3E%3Ccircle cx="15" cy="25" r="0.5"/%3E%3Ccircle cx="25" cy="25" r="0.5"/%3E%3Ccircle cx="35" cy="25" r="0.5"/%3E%3Ccircle cx="5" cy="35" r="0.5"/%3E%3Ccircle cx="15" cy="35" r="0.5"/%3E%3Ccircle cx="25" cy="35" r="0.5"/%3E%3Ccircle cx="35" cy="35" r="0.5"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" /> */}

      {/* Header with glassmorphism */}
      <header className="relative px-4 py-6 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-6 py-4 flex items-center justify-between shadow-2xl">
            {/* App Name Left */}
            <div className="flex-1 flex items-center">
              <div className="flex items-center gap-2">
                <FluidLogo />
              </div>
            </div>

            {/* Links Center */}
            <nav className="flex-1 flex items-center justify-center gap-8 text-sm">
              {["DeFi", "Gaming", "NFT", "Community"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-white/70 hover:text-green-400 transition-all duration-300 hover:scale-105"
                >
                  {item}
                </a>
              ))}
            </nav>

            {/* Button Right */}
            <div className="flex-1 flex justify-end">
              <Link to="/transition">
                <Button className="rounded-2xl bg-gradient-to-br from-green-800 to-green-600 hover:from-green-700 hover:to-green-500 text-white px-6 h-11 shadow-lg hover:shadow-green-800/25 transition-all duration-300 border-0">
                  Launch App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="relative px-4 z-10">
        <div className="max-w-5xl mx-auto text-center py-24 md:py-32">
          <h1 className="text-6xl md:text-7xl tracking-tight font-light leading-tight">
            <span className="bg-gradient-to-br from-emerald-400 via-green-300 to-lime-200 bg-clip-text text-transparent drop-shadow-[0_2px_24px_rgba(34,197,94,0.25)]">
              Build a calm DeFi Forest
            </span>
          </h1>
          <p className="mt-8 text-xl text-white/70 max-w-2xl mx-auto font-light leading-relaxed">
            A clear, fast and accessible experience. Simple DeFi mechanics,
            playful rewards, and subtle emerald touches.
          </p>
          <div className="mt-16 flex items-center justify-center gap-6">
            <Link to="/transition">
              <Button className="rounded-2xl bg-gradient-to-br from-green-800 to-green-600 hover:from-green-700 hover:to-green-500 text-white px-10 h-14 text-lg shadow-2xl hover:shadow-green-800/30 transition-all duration-300 border-0 hover:scale-105">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-2xl border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-green-600/50 px-10 h-14 text-lg transition-all duration-300 hover:scale-105"
            >
              Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Stats with glass cards */}
      <section className="relative px-4 py-16 z-10">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-3">
          {[
            { value: "$2.4M", label: "Volume" },
            { value: "15K", label: "Players" },
            { value: "99.9%", label: "Uptime" },
          ].map((item, idx) => (
            <Card
              key={idx}
              className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl hover:shadow-green-800/10 transition-all duration-500 rounded-3xl hover:scale-105 hover:bg-white/10 group"
            >
              <CardContent className="p-10 text-center">
                <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-gradient-to-br from-green-800 to-green-600 group-hover:w-20 transition-all duration-300" />
                <div className="text-5xl text-white font-light tracking-tight mb-3 group-hover:text-green-400 transition-colors duration-300">
                  {item.value}
                </div>
                <div className="text-white/60 font-light text-lg">
                  {item.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* DeFi Section */}
      <section id="defi" className="relative px-4 py-32 z-10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl text-white font-light tracking-tight leading-tight">
              Clean DeFi, designed for{" "}
              <span className="text-green-400">play</span>
            </h2>
            <p className="mt-8 text-white/70 font-light leading-relaxed text-lg">
              Swaps, light staking, quests. Interactions remain clear and fast.
              Colors serve information, with a subtle green accent.
            </p>
            <div className="mt-12 flex gap-4">
              <Link to="/transition">
                <Button className="rounded-2xl bg-gradient-to-br from-green-800 to-green-600 hover:from-green-700 hover:to-green-500 text-white px-8 h-12 shadow-lg hover:shadow-green-800/25 transition-all duration-300 hover:scale-105">
                  Launch App
                </Button>
              </Link>
              <Button
                variant="outline"
                className="rounded-2xl border-white/20 bg-white/5 backdrop-blur-xl hover:bg-white/10 text-white px-8 h-12 transition-all duration-300 hover:scale-105"
              >
                Learn more
              </Button>
            </div>
          </div>

          {/* Glass visual with enhanced effects */}
          <div className="relative h-[400px] rounded-3xl overflow-hidden bg-gradient-to-br from-green-800/10 via-white/5 to-green-600/5 border border-white/10 shadow-2xl">
            <div className="absolute inset-1 rounded-3xl bg-gradient-to-br" />
            <div className="absolute inset-0">
              <svg viewBox="0 0 600 400" className="w-full h-full">
                <defs>
                  <linearGradient id="glowGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#166534" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#15803d" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity="0.4" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {Array.from({ length: 20 }).map((_, i) => (
                  <circle
                    key={i}
                    cx={40 + i * 28}
                    cy={200 + Math.sin(i / 2.5) * 60}
                    r={8}
                    fill="url(#glowGradient)"
                    filter="url(#glow)"
                    className="animate-pulse"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: "3s",
                    }}
                  />
                ))}
                {/* Connecting lines */}
                {Array.from({ length: 19 }).map((_, i) => (
                  <line
                    key={`line-${i}`}
                    x1={40 + i * 28}
                    y1={200 + Math.sin(i / 2.5) * 60}
                    x2={40 + (i + 1) * 28}
                    y2={200 + Math.sin((i + 1) / 2.5) * 60}
                    stroke="url(#glowGradient)"
                    strokeWidth="2"
                    opacity="0.4"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* CTA with enhanced glass effect */}
      <section className="relative px-4 py-32 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-green-800/5 to-white/5 backdrop-blur-xl shadow-2xl">
            <div className="absolute -inset-px rounded-3xl opacity-30 bg-gradient-to-br from-green-800/20 via-transparent to-green-600/20" />
            <div className="relative px-12 md:px-20 py-20 text-center">
              <h3 className="text-4xl md:text-5xl text-white font-light tracking-tight leading-tight">
                Ready to <span className="text-green-400">grow</span>?
              </h3>
              <p className="mt-6 text-white/70 font-light max-w-2xl mx-auto text-lg leading-relaxed">
                Connect your wallet and start growing your forest. A clear UI, a
                well-balanced green accent.
              </p>
              <div className="mt-12 flex justify-center">
                <Link to="/transition">
                  <Button className="rounded-2xl bg-gradient-to-br from-green-800 to-green-600 hover:from-green-700 hover:to-green-500 text-white px-12 h-14 text-lg shadow-2xl hover:shadow-green-800/30 transition-all duration-300 hover:scale-105">
                    Connect Wallet
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with glass effect */}
      <footer className="relative px-4 py-12 border-t border-white/10 z-10">
        <div className="absolute inset-0  backdrop-blur-xl" />
        <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-white/60">
          <span className="font-light text-lg">
            © {new Date().getFullYear()} SwapForest
          </span>
          <nav className="flex items-center gap-8">
            {["Privacy", "Terms", "Docs"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="hover:text-green-400 transition-colors duration-300 font-light"
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
