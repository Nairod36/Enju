import { TreePine } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FluidLogo from "@/components/FluidLogo";
import { OrbitControls } from "@react-three/drei";
import { FloatingIsland } from "@/pages/app/island/island";
import { usePublicIslands } from "@/hooks/usePublicIslands";
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OneInchLogo } from "@/components/logos/OneInchLogo";

export default function HomePage() {
  const { islands, loading } = usePublicIslands();
  const [randomIsland, setRandomIsland] = useState<any>(null);

  // Select a random island when islands are loaded
  useEffect(() => {
    if (islands && islands.length > 0) {
      const randomIndex = Math.floor(Math.random() * islands.length);
      setRandomIsland(islands[randomIndex]);
    }
  }, [islands]);

  return (
    <div className="relative min-h-screen text-slate-800 font-sans selection:bg-emerald-200/60 selection:text-slate-900">
      {/* Light backgrounds with green accents */}
      <div className="pointer-events-none fixed inset-0 -z-10" />

      {/* Header - App Style */}
      <header className="top-0 left-0 right-0 z-50 backdrop-blur bg-white/95">
        <div className="max-w-full border-b">
          <div className="px-6 md:px-24 mx-32 flex items-center justify-between">
            {/* Logo & Brand */}
            <Link
              to="/"
              className="flex items-center gap-2 hover:scale-105 transition-all duration-300"
            >
              <div className="flex flex-row items-center py-3">
                <FluidLogo />
                <div className="text-2xl pl-3 font-light text-green-800 tracking-wide">
                  enju
                </div>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm pt-1">
              <a
                href="https://github.com/Nairod36/Enju"
                className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
              >
                Github
              </a>
              <a
                href="https://github.com/Nairod36/Enju"
                className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
              >
                Documentation
              </a>
              <a
                href="https://github.com/Nairod36/Enju"
                className="text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
              >
                About
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link to="/app">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 text-sm font-medium">
                  Launch App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Interactive Demo */}
      <section className="px-4 py-12 bg-gradient-to-b from-white to-emerald-50/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-light">
                  <span className="bg-gradient-to-r from-slate-900 to-emerald-700 bg-clip-text text-transparent">
                    Cross-Chain Bridge & Island Explorer
                  </span>
                </h1>
                <p className="mt-6 text-lg text-slate-600 font-light leading-relaxed">
                  Seamless cross-chain swaps between ETH, NEAR, and TRON
                  networks. Explore beautiful 3D islands while earning rewards
                  through DeFi.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/app">
                  <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 font-medium">
                    Start Bridging
                  </Button>
                </Link>
                <Link to="/app/explorer">
                  <Button
                    variant="outline"
                    className="rounded-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-8 h-12 font-medium"
                  >
                    Explore Islands
                  </Button>
                </Link>
              </div>

              {/* Mini Stats */}
              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-light text-slate-900">3</div>
                  <div className="text-sm text-slate-500">Networks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-light text-slate-900">
                    {loading ? "..." : islands.length.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-500">Islands</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-light text-slate-900">
                    {loading 
                      ? "..." 
                      : islands.reduce((sum, island) => sum + (island.totalTrees || 0), 0).toLocaleString()
                    }
                  </div>
                  <div className="text-sm text-slate-500">Trees</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-light text-slate-900">
                    $ --
                  </div>
                  <div className="text-sm text-slate-500">Bridge Volume</div>
                </div>
              </div>
            </div>

            {/* Right - Real 3D Island */}
            <div className="relative">
              <div className="aspect-square max-w-lg mx-auto">
                {/* 3D Canvas Container */}
                <div className="relative w-full h-full rounded-3xl overflow-hidden">
                  <Canvas
                    camera={{ position: [8, 8, 8], fov: 80 }}
                    className="w-full h-full"
                  >
                    <ambientLight intensity={0.4} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <OrbitControls
                      enablePan={false}
                      enableZoom={true}
                      enableRotate={true}
                      autoRotate={true}
                      autoRotateSpeed={1}
                      minDistance={6}
                      maxDistance={15}
                      maxPolarAngle={Math.PI / 2.2}
                    />

                    {randomIsland ? (
                      <FloatingIsland
                        seed={
                          parseInt(randomIsland.seed) ||
                          Math.floor(Math.random() * 10000)
                        }
                        initialTreeCount={randomIsland.totalTrees || 5}
                        preloadedIslandData={randomIsland.islandData}
                      />
                    ) : loading ? (
                      <mesh>
                        <boxGeometry args={[2, 0.5, 2]} />
                        <meshStandardMaterial color="#10b981" />
                      </mesh>
                    ) : (
                      <FloatingIsland
                        seed={Math.floor(Math.random() * 10000)}
                        initialTreeCount={5}
                      />
                    )}
                  </Canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-slate-900 font-light tracking-tight mb-4">
              Clean DeFi, designed for everyone
            </h2>
            <p className="text-lg text-slate-600 font-light max-w-2xl mx-auto">
              Experience seamless cross-chain swaps, interactive 3D islands, and
              meaningful rewards. Built for clarity, speed, and joy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {[
              {
                title: "Cross-Chain Bridge",
                description:
                  "Seamless swaps between ETH, NEAR, and TRON networks with real-time monitoring.",
                icon: "🌉",
                color: "from-blue-500 to-emerald-500",
              },
              {
                title: "3D Island Explorer",
                description:
                  "Build and explore beautiful 3D islands. Earn rewards through interactive gameplay.",
                icon: "🏝️",
                color: "from-emerald-500 to-green-500",
              },
              {
                title: "1inch Integration",
                description:
                  "Best rates and optimal routing powered by 1inch's advanced DeFi protocols.",
                icon: <OneInchLogo size={52} className="text-white" />,
                color: "",
              },
            ].map((feature, idx) => (
              <Card
                key={idx}
                className="border border-slate-200/60 bg-white shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl p-6 group hover:scale-105 h-full flex flex-col"
              >
                <CardContent className="p-0 flex-1 flex flex-col">
                  {/* Icon */}
                  <div className="mb-6">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300`}
                    >
                      {feature.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xl font-medium text-slate-900 mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 font-light leading-relaxed flex-1">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-white to-emerald-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-white to-emerald-50/80 shadow-xl">
            <div className="absolute -inset-px rounded-3xl opacity-40 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.25),transparent_55%)]" />
            <div className="relative px-8 md:px-12 py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-emerald-100 rounded-2xl">
                <TreePine className="w-8 h-8 text-emerald-600" />
              </div>

              <h3 className="text-3xl md:text-4xl text-slate-900 font-light tracking-tight mb-4">
                Ready to start your journey?
              </h3>
              <p className="text-lg text-slate-600 font-light max-w-2xl mx-auto mb-8">
                Join thousands of DeFi explorers building their forest.
                Experience seamless cross-chain swaps and discover beautiful 3D
                worlds.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/app">
                  <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 font-medium">
                    Launch App
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="rounded-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-8 h-12 font-medium"
                >
                  View Documentation
                </Button>
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
            <a href="#privacy" className="hover:text-slate-700">
              Privacy
            </a>
            <a href="#terms" className="hover:text-slate-700">
              Terms
            </a>
            <a href="/docs" className="hover:text-slate-700">
              Docs
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
