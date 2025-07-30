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
  const logsEndRef = useRef<HTMLDivElement>(null);

  const direction = bridgeData
    ? (`${bridgeData.fromChain}-to-${bridgeData.toChain}` as keyof typeof stepConfigs)
    : "ethereum-to-near";
  const steps = stepConfigs[direction] || stepConfigs["ethereum-to-near"];

  useEffect(() => {
    if (isOpen && bridgeData) {
      // Reset state
      setLogs([]);
      setCurrentStep(0);
      setStatus("pending");
      setBridgeId(null);
      setSecret(null);
      setHashlock(null);

      // Start bridge process simulation
      startBridgeProcess();
    }
  }, [isOpen, bridgeData]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: BridgeLog["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  const startBridgeProcess = async () => {
    if (!bridgeData) return;

    try {
      // Step 1: Generate secret and hashlock
      addLog("🔑 Generating secret and hashlock...", "info");

      // Simulate secret generation (in real app, this would come from the actual bridge)
      const mockSecret = "0x" + Math.random().toString(16).substring(2, 66);
      const mockHashlock = "0x" + Math.random().toString(16).substring(2, 66);
      setSecret(mockSecret);
      setHashlock(mockHashlock);

      addLog(`🔒 Generated hashlock: ${mockHashlock}`, "success");
      setCurrentStep(1);

      // Step 2: Initiate bridge
      await new Promise((resolve) => setTimeout(resolve, 1000));
      addLog(
        `🚀 Initiating ${bridgeData.fromChain.toUpperCase()} → ${bridgeData.toChain.toUpperCase()} bridge...`,
        "info"
      );
      addLog(
        `💰 Amount: ${
          bridgeData.fromAmount
        } ${bridgeData.fromChain.toUpperCase()}`,
        "info"
      );

      if (bridgeData.nearAccount) {
        addLog(`📧 NEAR Account: ${bridgeData.nearAccount}`, "info");
      }

      // Step 3: Transaction confirmation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockTxHash = "0x" + Math.random().toString(16).substring(2, 66);
      addLog(`📝 Transaction sent: ${mockTxHash}`, "info");
      addLog("⏳ Waiting for confirmation...", "info");
      setCurrentStep(2);

      // Step 4: Create HTLC/Escrow
      await new Promise((resolve) => setTimeout(resolve, 3000));
      addLog("✅ Transaction confirmed!", "success");
      addLog("🔄 Creating cross-chain contract...", "info");
      setCurrentStep(3);

      // Step 5: Complete bridge
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockBridgeId = `bridge_${Math.random()
        .toString(16)
        .substring(2, 10)}`;
      setBridgeId(mockBridgeId);
      addLog(`📦 Bridge created: ${mockBridgeId}`, "success");
      addLog("🚀 Auto-completing bridge...", "info");

      await new Promise((resolve) => setTimeout(resolve, 3000));
      addLog("🎯 Bridge completed successfully!", "success");
      addLog(
        `✅ ${
          bridgeData.fromAmount
        } ${bridgeData.fromChain.toUpperCase()} → ${bridgeData.toChain.toUpperCase()} transfer complete`,
        "success"
      );

      setCurrentStep(4);
      setStatus("success");
    } catch (error) {
      addLog(`❌ Bridge failed: ${error}`, "error");
      setStatus("error");
    }
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

          {/* Logs Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 text-sm">Bridge Logs</h4>
            <div className="bg-black text-green-400 p-4 rounded-lg h-48 overflow-y-auto font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-gray-500">Ready to bridge... 🌉</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`
                    ${log.type === "error" ? "text-red-400" : ""}
                    ${log.type === "success" ? "text-green-400" : ""}
                    ${log.type === "warning" ? "text-yellow-400" : ""}
                    ${log.type === "info" ? "text-blue-300" : ""}
                  `}
                  >
                    [{log.timestamp}] {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
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
