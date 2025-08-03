import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Code2,
  GitBranch,
  Zap,
  Shield,
  Globe,
  ExternalLink,
  BookOpen,
  Users,
  Wrench,
} from "lucide-react";
import FluidLogo from "@/components/FluidLogo";
import { AppFooter } from "@/components/layout/AppFooter";

export default function DocumentationPage() {
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
                to="/"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/app"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                App
              </Link>
              <Link to="/docs" className="text-emerald-700 font-medium">
                Documentation
              </Link>
            </nav>
            {/* Button Right */}
            <div className="flex-1 flex justify-end">
              <Link to="/app">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10">
                  Launch App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 pt-16 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <BookOpen size={16} />
            Documentation
          </div>
          <h1 className="text-4xl md:text-6xl text-slate-900 font-normal tracking-tight mb-6">
            Enju Protocol
            <br />
            <span className="text-emerald-600">Developer Guide</span>
          </h1>
          <p className="text-xl text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
            Complete documentation for building cross-chain DeFi applications
            with Enju's advanced bridge technology and 1inch integration.
          </p>
        </div>
      </section>

      {/* Quick Start */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl text-slate-900 font-normal tracking-tight mb-12 text-center">
            Quick Start Guide
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/80 border-slate-200 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Code2 className="text-emerald-600" size={24} />
                </div>
                <CardTitle className="text-slate-900 font-normal">
                  1. Setup Environment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Install dependencies and configure your development
                  environment for cross-chain development.
                </p>
                <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm">
                  <code>npm install @enju/sdk</code>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 border-slate-200 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <GitBranch className="text-emerald-600" size={24} />
                </div>
                <CardTitle className="text-slate-900 font-normal">
                  2. Initialize Bridge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Connect to Ethereum and NEAR networks through our unified
                  bridge interface.
                </p>
                <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm">
                  <code>enju.bridge.initialize()</code>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 border-slate-200 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="text-emerald-600" size={24} />
                </div>
                <CardTitle className="text-slate-900 font-normal">
                  3. Execute Swaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Perform cross-chain swaps with 1inch integration and automatic
                  routing.
                </p>
                <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm">
                  <code>enju.swap.execute(params)</code>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="px-4 py-16 bg-gradient-to-br from-emerald-50/50 to-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl text-slate-900 font-normal tracking-tight mb-12 text-center">
            Protocol Architecture
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl text-slate-900 font-normal mb-6">
                Cross-Chain Bridge Technology
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mt-1">
                    <Shield className="text-emerald-600" size={14} />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">
                      Secure Escrow System
                    </h4>
                    <p className="text-slate-600 text-sm">
                      Hash Time-Locked Contracts (HTLC) ensure atomic swaps
                      between chains.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mt-1">
                    <Globe className="text-emerald-600" size={14} />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">
                      Multi-Chain Support
                    </h4>
                    <p className="text-slate-600 text-sm">
                      Native integration with Ethereum, NEAR, and TRON networks.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mt-1">
                    <Zap className="text-emerald-600" size={14} />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">
                      1inch Integration
                    </h4>
                    <p className="text-slate-600 text-sm">
                      Leverage 1inch's DEX aggregation and Fusion+ technology
                      for optimal rates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative h-[400px] rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-200/60 via-emerald-100 to-white">
              <div className="absolute inset-px rounded-[22px] bg-white/60 backdrop-blur" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🌉</div>
                  <h4 className="text-slate-700 font-medium">
                    Cross-Chain Bridge
                  </h4>
                  <p className="text-slate-500 text-sm mt-2">
                    ETH ↔ NEAR ↔ TRON
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Reference */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl text-slate-900 font-normal tracking-tight mb-12 text-center">
            API Reference
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white/80 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 font-normal flex items-center gap-2">
                  <Code2 size={20} />
                  Bridge API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    Core Methods
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>bridge.initialize(config)</code>
                    </div>
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>bridge.createSwap(params)</code>
                    </div>
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>bridge.executeSwap(swapId)</code>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-full">
                  View Full API Reference
                  <ExternalLink size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white/80 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 font-normal flex items-center gap-2">
                  <Wrench size={20} />
                  1inch Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    Available APIs
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>oneInch.getQuote(params)</code>
                    </div>
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>oneInch.executeSwap(quote)</code>
                    </div>
                    <div className="bg-slate-50 rounded p-2 font-mono">
                      <code>oneInch.fusion.createOrder()</code>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-full">
                  1inch API Documentation
                  <ExternalLink size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Getting Help */}
      <section className="px-4 py-16 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl text-slate-900 font-normal tracking-tight mb-6">
            Need Help?
          </h2>
          <p className="text-slate-600 font-normal leading-relaxed mb-12">
            Our community and support team are here to help you build amazing
            cross-chain applications.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8">
              <Users size={16} className="mr-2" />
              Join Discord
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-slate-300 hover:bg-slate-100 text-slate-800 px-8"
            >
              <BookOpen size={16} className="mr-2" />
              GitHub Repository
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-slate-300 hover:bg-slate-100 text-slate-800 px-8"
            >
              View Examples
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
