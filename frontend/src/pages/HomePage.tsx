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
    <div className="relative min-h-screen text-slate-800 font-sans selection:bg-emerald-200/60 selection:text-slate-900">
      {/* Light backgrounds with green accents */}
      <div className="pointer-events-none fixed inset-0 -z-10" />

      {/* Header */}
      <header className="px-4 py-6 bg-gradient-to-r from-white/80 to-emerald-20/40 backdrop-blur">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 rounded-full px-6 py-4 flex items-center justify-between shadow-md">
            {/* App Name Left */}
            <div className="flex-1 flex items-center">
              <FluidLogo />
            </div>
            {/* Links Center */}
            <nav className="flex-1 flex items-center justify-center gap-6 text-sm">
              <Link
                to="#defi"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                DeFi
              </Link>
              <Link
                to="#gaming"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Gaming
              </Link>
              <Link
                to="#nft"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                NFT
              </Link>
              <Link
                to="#community"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Community
              </Link>
            </nav>
            {/* Button Right */}
            <div className="flex-1 flex justify-end">
              <Link to="/transition">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10">
                  Launch App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="px-4">
        <div className="max-w-5xl mx-auto text-center py-24 md:py-28">
          <h1 className="text-5xl md:text-6xl tracking-tight font-normal">
            <span className="bg-gradient-to-r from-slate-900 to-emerald-700 bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
              Build a calm DeFi Forest
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto font-normal">
            A clear, fast and accessible experience. Simple DeFi mechanics,
            playful rewards, and subtle emerald touches.
          </p>
          <div className="mt-12 flex items-center justify-center gap-4">
            <Link to="/transition">
              <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12">
                Get Started
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-8 h-12"
            >
              Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-10">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
          {[
            { value: "$2.4M", label: "Volume" },
            { value: "15K", label: "Players" },
            { value: "99.9%", label: "Uptime" },
          ].map((item, idx) => (
            <Card
              key={idx}
              className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl"
            >
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                <div className="text-4xl text-slate-900 font-normal tracking-tight">
                  {item.value}
                </div>
                <div className="mt-2 text-slate-500 font-normal">
                  {item.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* DeFi Section */}
      <section id="defi" className="px-4 py-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl text-slate-900 font-normal tracking-tight">
              Clean DeFi, designed for play
            </h2>
            <p className="mt-5 text-slate-600 font-normal leading-relaxed">
              Swaps, light staking, quests. Interactions remain clear and fast.
              Colors serve information, with a subtle green accent.
            </p>
            <div className="mt-10 flex gap-3">
              <Link to="/transition">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-11">
                  Launch App
                </Button>
              </Link>
              <Button
                variant="outline"
                className="rounded-full border-slate-300 hover:bg-slate-100 text-slate-800 px-6 h-11"
              >
                Learn more
              </Button>
            </div>
          </div>

          {/* light visual placeholder */}
          <div className="relative h-[360px] rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-200/60 via-emerald-100 to-white">
            <div className="absolute inset-px rounded-[22px] bg-white/60 backdrop-blur" />
            <div className="absolute inset-0">
              <svg viewBox="0 0 600 360" className="w-full h-full opacity-60">
                <defs>
                  <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                {Array.from({ length: 18 }).map((_, i) => (
                  <circle
                    key={i}
                    cx={30 + i * 32}
                    cy={180 + Math.sin(i / 2) * 40}
                    r={6}
                    fill="url(#g)"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50">
            <div className="absolute -inset-px rounded-3xl opacity-40 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.25),transparent_55%)]" />
            <div className="relative px-8 md:px-14 py-16 text-center">
              <h3 className="text-3xl md:text-4xl text-slate-900 font-normal tracking-tight">
                Ready to grow?
              </h3>
              <p className="mt-4 text-slate-600 font-normal max-w-2xl mx-auto">
                Connect your wallet and start growing your forest. A clear UI, a
                well-balanced green accent.
              </p>
              <div className="mt-10 flex justify-center">
                <Link to="/transition">
                  <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12">
                    Connect Wallet
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-10 border-t border-slate-200 text-sm bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500">
          <span className="font-normal">
            © {new Date().getFullYear()} SwapForest
          </span>
          <nav className="flex items-center gap-6">
            <Link to="#privacy" className="hover:text-slate-700">
              Privacy
            </Link>
            <Link to="#terms" className="hover:text-slate-700">
              Terms
            </Link>
            <Link to="#docs" className="hover:text-slate-700">
              Docs
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
