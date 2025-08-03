import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
} from "lucide-react";
import { BRIDGE_CONFIG } from "@/config/networks";
import { ConversionDisplay } from "./ConversionDisplay";

interface BridgeLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridgeData: {
    fromAmount: string;
    fromChain: string;
    toChain: string;
    nearAccount?: string;
    txHash?: string;
    logs?: string[];
    status?: 'pending' | 'success' | 'error';
    hashlock?: string;
    secret?: string;
    escrow?: string;
    contractId?: string;
  } | null;
}

const stepConfigs = {
  "ethereum-to-near": [
    {
      id: "initiate",
      label: "Initiate ETH Bridge",
      description: "Creating escrow transaction",
    },
    {
      id: "confirm",
      label: "Confirm Transaction",
      description: "Waiting for ETH confirmation",
    },
    {
      id: "create-htlc",
      label: "Create NEAR HTLC",
      description: "Setting up NEAR contract",
    },
    {
      id: "complete",
      label: "Complete Bridge",
      description: "Finalizing cross-chain transfer",
    },
  ],
  "near-to-ethereum": [
    {
      id: "initiate",
      label: "Initiate NEAR Bridge",
      description: "Creating NEAR HTLC",
    },
    {
      id: "confirm",
      label: "Confirm NEAR Tx",
      description: "Waiting for NEAR confirmation",
    },
    {
      id: "create-escrow",
      label: "Create ETH Escrow",
      description: "Setting up ETH contract",
    },
    {
      id: "complete",
      label: "Complete Bridge",
      description: "Finalizing cross-chain transfer",
    },
  ],
  "ethereum-to-tron": [
    {
      id: "initiate",
      label: "Initiate ETH Bridge",
      description: "Creating ETH escrow transaction",
    },
    {
      id: "confirm",
      label: "Confirm ETH Transaction",
      description: "Waiting for ETH confirmation",
    },
    {
      id: "auto-relay",
      label: "Auto-Relay Processing",
      description: "Bridge-listener sending TRX automatically",
    },
    {
      id: "complete",
      label: "Bridge Complete",
      description: "TRX received automatically",
    },
  ],
  "tron-to-ethereum": [
    {
      id: "initiate",
      label: "Initiate TRON Bridge",
      description: "Creating TRON HTLC transaction",
    },
    {
      id: "confirm",
      label: "Confirm TRON Tx",
      description: "Waiting for TRON confirmation",
    },
    {
      id: "create-escrow",
      label: "Create ETH Escrow",
      description: "Bridge-listener creating ETH escrow",
    },
    {
      id: "complete",
      label: "Complete Bridge",
      description: "Finalizing cross-chain transfer",
    },
  ],
};

export function BridgeModal({ isOpen, onClose, bridgeData }: BridgeModalProps) {
  const [logs, setLogs] = useState<BridgeLog[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [bridgeId, setBridgeId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hashlock, setHashlock] = useState<string | null>(null);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const direction = bridgeData
    ? (`${bridgeData.fromChain}-to-${bridgeData.toChain}` as keyof typeof stepConfigs)
    : "ethereum-to-near";
  const steps = stepConfigs[direction] || stepConfigs["ethereum-to-near"];

  useEffect(() => {
    if (isOpen && bridgeData) {
      // Only initialize if logs are empty (first time opening)
      if (logs.length === 0) {
        const initialLogs = bridgeData.logs || [];
        const convertedLogs = initialLogs.map((logString: string) => {
          const timestampMatch = logString.match(/\[(\d+:\d+:\d+)\](.*)/);
          if (timestampMatch) {
            return {
              timestamp: timestampMatch[1],
              message: timestampMatch[2].trim(),
              type: logString.includes('❌') ? 'error' as const :
                     logString.includes('✅') ? 'success' as const :
                     logString.includes('⚠️') ? 'warning' as const :
                     'info' as const
            };
          }
          return {
            timestamp: new Date().toLocaleTimeString(),
            message: logString,
            type: 'info' as const
          };
        });
        
        setLogs(convertedLogs);
      }
      
      // Always update status and metadata
      setStatus(bridgeData.status || "pending");
      setSecret(bridgeData.secret || null);
      setHashlock(bridgeData.hashlock || null);
      
      // Set step based on status
      if (bridgeData.status === 'success') {
        setCurrentStep(4);
      } else if (bridgeData.txHash) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
      
      // Start monitoring bridge status if still pending
      if (bridgeData.status === 'pending' || !bridgeData.status) {
        startBridgeMonitoring();
      }
    }
    
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [isOpen, bridgeData]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: BridgeLog["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  const startBridgeMonitoring = async () => {
    if (!bridgeData) return;
    
    // Clear any existing interval
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
    
    // Monitor bridge status every 5 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
        const result = await response.json();
        
        let bridges = [];
        if (Array.isArray(result)) {
          bridges = result;
        } else if (result.bridges && Array.isArray(result.bridges)) {
          bridges = result.bridges;
        } else if (result.data && Array.isArray(result.data)) {
          bridges = result.data;
        }
        
        // Find bridge by hashlock or tx hash
        const currentBridge = bridges.find((bridge: any) => 
          (bridgeData.hashlock && bridge.hashlock === bridgeData.hashlock) ||
          (bridgeData.txHash && bridge.ethTxHash === bridgeData.txHash)
        );
        
        if (currentBridge) {
          // Update progress based on bridge status
          if (currentBridge.status === 'COMPLETED') {
            addLog('✅ Bridge completed successfully!', 'success');
            setCurrentStep(4);
            setStatus('success');
            setBridgeId(currentBridge.id);
            
            // Clear monitoring
            clearInterval(interval);
          } else if (currentBridge.contractId && currentStep < 3) {
            addLog('🔄 Cross-chain contract created', 'info');
            setCurrentStep(3);
          } else if (currentBridge.ethTxHash && currentStep < 2) {
            addLog('✅ Transaction confirmed!', 'success');
            setCurrentStep(2);
          }
        }
      } catch (error) {
        console.error('Error monitoring bridge:', error);
      }
    }, 5000);
    
    setMonitoringInterval(interval);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog("📋 Copied to clipboard!", "info");
  };

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep)
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (stepIndex === currentStep && status === "pending")
      return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
    if (status === "error" && stepIndex === currentStep)
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[100vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-sm">
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </div>
            Bridge Transaction
            {status === "success" && (
              <CheckCircle className="w-5 h-5 text-green-500 text-sm" />
            )}
            {status === "error" && (
              <AlertCircle className="w-5 h-5 text-red-500 text-sm" />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-gray-500">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />

            {/* Steps */}
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  {getStepIcon(index)}
                  <div className="flex-1">
                    <div className="flex justify-between items-center text-sm">
                      <span
                        className={`font-medium ${
                          index <= currentStep
                            ? "text-gray-900"
                            : "text-gray-500"
                        }`}
                      >
                        {step.label}
                      </span>
                      {index === currentStep && status === "pending" && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Conversion Display */}
          {bridgeData && (
            <ConversionDisplay
              fromAmount={bridgeData.fromAmount}
              fromChain={bridgeData.fromChain as "ethereum" | "near" | "tron"}
              toChain={bridgeData.toChain as "ethereum" | "near" | "tron"}
              className="mb-4"
            />
          )}

          {/* Bridge Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 text-sm">Bridge Status</h4>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4 rounded-lg space-y-3">
              
              {/* Transaction Hash */}
              {bridgeData?.txHash && (
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-700">Transaction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-blue-50 px-2 py-1 rounded text-blue-700">
                      {bridgeData.txHash.substring(0, 8)}...{bridgeData.txHash.substring(-4)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(bridgeData.txHash!)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Bridge ID */}
              {bridgeId && (
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-700">Bridge ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-purple-50 px-2 py-1 rounded text-purple-700">
                      {bridgeId.substring(0, 12)}...
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(bridgeId)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Amount Info */}
              <div className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700">Amount</span>
                </div>
                <span className="text-xs font-mono text-gray-900">
                  {bridgeData?.fromAmount} {bridgeData?.fromChain?.toUpperCase()}
                </span>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    status === 'success' ? 'bg-green-500' :
                    status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                  }`}></div>
                  <span className="text-xs font-medium text-gray-700">Status</span>
                </div>
                <span className={`text-xs font-medium ${
                  status === 'success' ? 'text-green-700' :
                  status === 'error' ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {status === 'pending' ? 'Processing...' :
                   status === 'success' ? 'Completed' : 'Failed'}
                </span>
              </div>

              {/* Live Activity Feed */}
              {logs.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs font-medium text-gray-700 mb-2">Recent Activity</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {logs.slice(-3).map((log, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          log.type === "error" ? "bg-red-400" :
                          log.type === "success" ? "bg-green-400" :
                          log.type === "warning" ? "bg-yellow-400" : "bg-blue-400"
                        }`}></div>
                        <div className="flex-1">
                          <span className="text-gray-500">{log.timestamp}</span>
                          <p className="text-gray-700">{log.message}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Details */}
          {bridgeData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <h4 className="font-medium text-gray-900 text-sm">
                Transaction Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                {hashlock && (
                  <div className="col-span-2 flex items-center">
                    <span className="text-gray-500 w-16">Hashlock:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-white px-2 py-1 rounded border font-mono">
                        {hashlock.substring(0, 20)}...
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(hashlock)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {secret && (
                  <div className="col-span-2 flex items-center">
                    <span className="text-gray-500 w-16">Secret:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-white px-2 py-1 rounded border font-mono">
                        {secret.substring(0, 20)}...
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(secret)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              {status === "pending" && "Processing..."}
              {status === "success" && "✅ Bridge completed successfully!"}
              {status === "error" && "❌ Bridge failed"}
            </div>
            <div className="flex gap-2">
              {bridgeId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `${BRIDGE_CONFIG.listenerApi}/bridges`,
                      "_blank"
                    )
                  }
                >
                  View Bridge
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              )}
              <Button
                onClick={onClose}
                disabled={status === "pending"}
                variant={status === "success" ? "default" : "outline"}
              >
                {status === "pending" ? "Processing..." : "Close"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
