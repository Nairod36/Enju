import { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ArrowRightLeft, ChevronDown, Activity, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useBridge } from "../../hooks/useBridge";
import { useEscrowEventListener } from "../../hooks/useEscrowEventListener";

export function AppDashboard() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { executeBridge, isLoading: isBridging, error: bridgeError, clearError } = useBridge();
  const { events, isListening, error: eventError, startListening, stopListening, clearEvents } = useEscrowEventListener();
  
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromChain, setFromChain] = useState<"ethereum" | "near">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "near">("near");
  const [nearAccount, setNearAccount] = useState("");
  const [currentSwapHash, setCurrentSwapHash] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'creating' | 'monitoring' | 'completed' | 'failed'>('idle');

  // Start listening for events when component mounts
  useEffect(() => {
    if (isConnected) {
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [isConnected, startListening, stopListening]);

  // Monitor for swap completion
  useEffect(() => {
    if (currentSwapHash && events.length > 0) {
      const matchingEvent = events.find(event => 
        event.hashlock.toLowerCase() === currentSwapHash.toLowerCase()
      );
      
      if (matchingEvent) {
        setSwapStatus('completed');
        console.log('✅ Swap detected in events:', matchingEvent);
      }
    }
  }, [currentSwapHash, events]);

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleBridge = async () => {
    if (!isConnected || !fromAmount) return;
    
    clearError();
    setSwapStatus('creating');
    
    try {
      const result = await executeBridge({
        fromAmount,
        fromChain,
        toChain,
        nearAccount: toChain === 'near' ? nearAccount || 'user.testnet' : undefined
      });

      if (result.success) {
        console.log("Bridge successful:", result.txHash);
        setSwapStatus('monitoring');
        
        // If we have a hashlock from the bridge operation, monitor for events
        if (result.hashlock) {
          setCurrentSwapHash(result.hashlock);
        }
        
        // Reset form
        setFromAmount("");
        setToAmount("");
      } else {
        console.error("Bridge failed:", result.error);
        setSwapStatus('failed');
      }
    } catch (error) {
      console.error("Bridge error:", error);
      setSwapStatus('failed');
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-slate-900 mb-2">
          Welcome {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Guest"}
        </h1>
        <p className="text-slate-600">
          Bridge your tokens between Ethereum and NEAR
        </p>
      </div>

      {/* Bridge Section */}
      <div className="max-w-md mx-auto mb-8">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Swap Status Indicator */}
              {swapStatus !== 'idle' && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  {swapStatus === 'creating' && (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-slate-600">Creating swap transaction...</span>
                    </>
                  )}
                  {swapStatus === 'monitoring' && (
                    <>
                      <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />
                      <span className="text-sm text-slate-600">Monitoring for escrow events...</span>
                    </>
                  )}
                  {swapStatus === 'completed' && (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">Swap completed successfully!</span>
                    </>
                  )}
                  {swapStatus === 'failed' && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600">Swap failed</span>
                    </>
                  )}
                </div>
              )}
              {/* From Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">From</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={fromChain}
                      onChange={(e) => setFromChain(e.target.value as "ethereum" | "near")}
                      className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ethereum">ETH</option>
                      <option value="near">NEAR</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {isConnected && fromChain === "ethereum" && balance && (
                  <p className="text-xs text-slate-500">
                    Balance: {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                  </p>
                )}
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwapChains}
                  className="rounded-full w-10 h-10 p-0 hover:bg-emerald-50"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">To</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={toAmount}
                      onChange={(e) => setToAmount(e.target.value)}
                      className="w-full px-3 py-3 text-lg bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      disabled
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={toChain}
                      onChange={(e) => setToChain(e.target.value as "ethereum" | "near")}
                      className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="near">NEAR</option>
                      <option value="ethereum">ETH</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* NEAR Account Input (when bridging to NEAR) */}
              {toChain === 'near' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">NEAR Account</label>
                  <input
                    type="text"
                    placeholder="your-account.testnet"
                    value={nearAccount}
                    onChange={(e) => setNearAccount(e.target.value)}
                    className="w-full px-3 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Bridge Button */}
              <Button
                onClick={handleBridge}
                disabled={!isConnected || !fromAmount || isBridging || (toChain === 'near' && !nearAccount)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBridging ? "Bridging..." : `Bridge to ${toChain.toUpperCase()}`}
              </Button>

              {/* Error Display */}
              {bridgeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{bridgeError}</p>
                </div>
              )}

              {/* Connection Status */}
              {!isConnected && (
                <p className="text-center text-sm text-slate-500">
                  Connect your wallet to start bridging
                </p>
              )}
              
              {isConnected && (
                <div className="text-center text-xs text-slate-400">
                  <p>✅ Wallet connected</p>
                  <p>Using 1inch Fusion+ Cross-Chain Technology</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Escrow Events */}
      {isConnected && events.length > 0 && (
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Live Escrow Events
                  {isListening && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      Listening
                    </span>
                  )}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearEvents}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Clear Events
                </Button>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {events.slice(0, 10).map((event, index) => (
                  <div
                    key={`${event.txHash}-${index}`}
                    className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-shrink-0">
                      {event.type === 'SrcEscrowCreated' ? (
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">
                          {event.type === 'SrcEscrowCreated' ? 'Source Escrow' : 'Destination Escrow'}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Escrow:</span>
                          <code className="text-xs bg-white px-2 py-1 rounded border">
                            {event.escrowAddress.slice(0, 8)}...{event.escrowAddress.slice(-6)}
                          </code>
                        </div>
                        
                        {event.amount && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Amount:</span>
                            <span className="text-emerald-600 font-mono">
                              {parseFloat(event.amount).toFixed(4)} ETH
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Hashlock:</span>
                          <code className="text-xs bg-white px-2 py-1 rounded border">
                            {event.hashlock.slice(0, 10)}...{event.hashlock.slice(-8)}
                          </code>
                        </div>
                        
                        <a
                          href={`https://etherscan.io/tx/${event.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          View on Etherscan →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
                
                {events.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No escrow events detected yet</p>
                    <p className="text-xs">Events will appear here when escrows are created</p>
                  </div>
                )}
              </div>
              
              {events.length > 10 && (
                <div className="text-center mt-4">
                  <p className="text-sm text-slate-500">
                    Showing latest 10 events ({events.length} total)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
