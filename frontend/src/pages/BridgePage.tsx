import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { BRIDGE_CONFIG, switchToForkNetwork } from "../config/networks";
import {
  parseNearAmount,
  formatNearAmount,
} from "near-api-js/lib/utils/format";

// ABI du contrat InchDirectBridge
const BRIDGE_ABI = [
  "event EscrowCreated(address indexed escrow, bytes32 indexed hashlock, string nearAccount, uint256 amount)",
  "event SwapCompleted(address indexed escrow, bytes32 secret)",
  "function createETHToNEARBridge(bytes32 hashlock, string calldata nearAccount) external payable returns (bytes32 swapId)",
  "function completeSwap(bytes32 swapId, bytes32 secret) external",
  "function getSwap(bytes32 swapId) external view returns (address escrow, address user, uint256 amount, bytes32 hashlock, string memory nearAccount, bool completed, uint256 createdAt)",
  "function checkEscrowFactory() external view returns (bool)",
];

interface BridgeEvent {
  id: string;
  type: "ETH_TO_NEAR" | "NEAR_TO_ETH";
  status: "PENDING" | "COMPLETED" | "FAILED";
  amount: string;
  hashlock: string;
  secret?: string;
  ethTxHash?: string;
  nearTxHash?: string;
  createdAt: number;
}

export function BridgePage() {
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  // Bridge state
  const [amount, setAmount] = useState<string>("1.0");
  const [nearAccount, setNearAccount] = useState<string>("mat-event.testnet");
  const [secret, setSecret] = useState<string>("");
  const [hashlock, setHashlock] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [bridgeEvents, setBridgeEvents] = useState<BridgeEvent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastGeneratedCommand, setLastGeneratedCommand] = useState<string>("");

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found!");
        return;
      }

      // Switch to fork network first
      const networkSwitched = await switchToForkNetwork();
      if (!networkSwitched) {
        addLog(
          "⚠️ MetaMask network switch failed - see console for manual setup"
        );
        return;
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);

      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      const bridgeContract = new ethers.Contract(
        BRIDGE_CONFIG.contractAddress,
        BRIDGE_ABI,
        web3Signer
      );

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setContract(bridgeContract);

      addLog(`✅ Wallet connected: ${address}`);

      // Check network
      const network = await web3Provider.getNetwork();
      addLog(`🌐 Network: ${network.name} (${network.chainId})`);

      // Check balance
      const balance = await web3Signer.getBalance();
      addLog(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

      // Check contract
      const factoryCheck = await bridgeContract.checkEscrowFactory();
      addLog(`📦 1inch Factory check: ${factoryCheck}`);
    } catch (error) {
      console.error("Wallet connection failed:", error);
      addLog(`❌ Wallet connection failed: ${error}`);
    }
  };

  // Connect with fork private key (for testing)
  const connectWithForkKey = async () => {
    try {
      // Hardhat default account #0 private key (has 10k ETH on fork)
      const forkPrivateKey =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

      const directProvider = new ethers.providers.JsonRpcProvider(
        BRIDGE_CONFIG.rpcUrl
      );
      const directSigner = new ethers.Wallet(forkPrivateKey, directProvider);
      const address = directSigner.address;

      const bridgeContract = new ethers.Contract(
        BRIDGE_CONFIG.contractAddress,
        BRIDGE_ABI,
        directSigner
      );

      setProvider(directProvider);
      setSigner(directSigner);
      setAccount(address);
      setContract(bridgeContract);

      addLog(`✅ Connected with fork account: ${address}`);
      addLog(`📡 Using direct fork connection: ${BRIDGE_CONFIG.rpcUrl}`);

      // Check balance
      const balance = await directSigner.getBalance();
      addLog(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

      // Check contract
      const factoryCheck = await bridgeContract.checkEscrowFactory();
      addLog(`📦 1inch Factory check: ${factoryCheck}`);

      // Get network info
      const network = await directProvider.getNetwork();
      addLog(
        `🌐 Network: Chain ID ${
          network.chainId
        }, Block ${await directProvider.getBlockNumber()}`
      );
    } catch (error) {
      console.error("Fork connection failed:", error);
      addLog(`❌ Fork connection failed: ${error}`);
    }
  };

  // Generate secret and hashlock
  const generateSecretAndHash = () => {
    const newSecret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const newHashlock = ethers.utils.sha256(newSecret);

    setSecret(newSecret);
    setHashlock(newHashlock);

    addLog(`🔑 Generated secret: ${newSecret}`);
    addLog(`🔒 Generated hashlock: ${newHashlock}`);
  };

  // Create ETH to NEAR bridge
  const createBridge = async () => {
    if (!contract || !signer) {
      alert("Please connect wallet first");
      return;
    }

    if (!secret || !hashlock) {
      alert("Please generate secret and hashlock first");
      return;
    }

    setIsLoading(true);
    addLog(`🚀 Initiating ETH → NEAR bridge...`);

    try {
      const tx = await contract.createETHToNEARBridge(hashlock, nearAccount, {
        value: ethers.utils.parseEther(amount),
        gasLimit: 500000,
      });

      addLog(`📝 Transaction sent: ${tx.hash}`);
      addLog(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();
      addLog(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse events
      const escrowCreatedEvent = receipt.events?.find(
        (event: any) => event.event === "EscrowCreated"
      );

      if (escrowCreatedEvent) {
        const {
          escrow,
          hashlock: eventHashlock,
          nearAccount: eventNearAccount,
          amount: eventAmount,
        } = escrowCreatedEvent.args;

        addLog(`📦 EscrowCreated event:`);
        addLog(`   Escrow: ${escrow}`);
        addLog(`   Hashlock: ${eventHashlock}`);
        addLog(`   NEAR Account: ${eventNearAccount}`);
        addLog(`   Amount: ${ethers.utils.formatEther(eventAmount)} ETH`);

        // Automatically create NEAR HTLC after ETH bridge
        addLog(`🔄 Automatically creating NEAR HTLC...`);

        // Wait a bit for ETH tx to be confirmed, then create NEAR HTLC
        setTimeout(async () => {
          await createNearHTLCAutomatically();
        }, 2000);
      }
    } catch (error) {
      console.error("Bridge creation failed:", error);
      addLog(`❌ Bridge creation failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Complete bridge with secret
  const completeBridge = async (bridgeId: string) => {
    if (!secret) {
      alert("Secret not available");
      return;
    }

    try {
      addLog(`🔓 Completing bridge with secret...`);

      // Call the bridge listener API to complete
      const response = await fetch(
        `${BRIDGE_CONFIG.listenerApi}/bridges/${bridgeId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ secret }),
        }
      );

      const result = await response.json();

      if (result.success) {
        addLog(`✅ Bridge completion initiated`);
        pollBridgeStatus();
      } else {
        addLog(`❌ Bridge completion failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Bridge completion failed:", error);
      addLog(`❌ Bridge completion failed: ${error}`);
    }
  };

  // Poll bridge status from API
  const pollBridgeStatus = async () => {
    try {
      const response = await fetch(`${BRIDGE_CONFIG.listenerApi}/bridges`);
      const result = await response.json();

      if (result.success) {
        setBridgeEvents(result.data);
        addLog(`📊 Bridge status updated: ${result.data.length} bridges found`);
      }
    } catch (error) {
      // Silently fail if bridge listener not available
    }
  };

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    setLastGeneratedCommand("");
  };

  // Copy CLI command to clipboard
  const copyCLICommand = async () => {
    if (lastGeneratedCommand) {
      try {
        await navigator.clipboard.writeText(lastGeneratedCommand);
        addLog(`📋 CLI command copied to clipboard!`);
      } catch (error) {
        addLog(`❌ Failed to copy to clipboard: ${error}`);
      }
    } else {
      addLog(`⚠️ No CLI command available to copy`);
    }
  };

  // Check NEAR contract status
  const checkNearContract = async () => {
    try {
      addLog(`🔍 Checking NEAR contract status...`);

      // You can use NEAR RPC directly to call view methods
      const response = await fetch("https://rpc.testnet.near.org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: "mat-event.testnet",
            method_name: "get_contract_count",
            args_base64: btoa("{}"),
          },
        }),
      });

      const result = await response.json();

      if (result.result && result.result.result) {
        const count = JSON.parse(
          new TextDecoder().decode(new Uint8Array(result.result.result))
        );
        addLog(`📊 NEAR contract has ${count} HTLCs`);

        // Get all contracts
        const allContractsResponse = await fetch(
          "https://rpc.testnet.near.org",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "dontcare",
              method: "query",
              params: {
                request_type: "call_function",
                finality: "final",
                account_id: "mat-event.testnet",
                method_name: "get_all_contracts",
                args_base64: btoa("{}"),
              },
            }),
          }
        );

        const allContractsResult = await allContractsResponse.json();
        if (allContractsResult.result && allContractsResult.result.result) {
          const contracts = JSON.parse(
            new TextDecoder().decode(
              new Uint8Array(allContractsResult.result.result)
            )
          );

          contracts.forEach((contract: any, index: number) => {
            const [id, details] = contract;
            addLog(`📋 HTLC ${index + 1}: ${id}`);
            addLog(`   Sender: ${details[0]}, Receiver: ${details[1]}`);
            addLog(`   Amount: ${details[2]} yoctoNEAR`);
            addLog(
              `   Status: ${
                details[5] ? "Withdrawn" : details[6] ? "Refunded" : "Pending"
              }`
            );
          });
        }
      }
    } catch (error) {
      addLog(`❌ Failed to check NEAR contract: ${error}`);
    }
  };

  // Create NEAR HTLC manually
  const createNearHTLCManually = async () => {
    if (isLoading) return; // Prevent multiple calls

    setIsLoading(true);

    try {
      addLog(`🚀 Creating NEAR HTLC manually...`);

      // First check if bridge listener is available
      const healthResponse = await fetch(
        `${BRIDGE_CONFIG.listenerApi}/health`,
        {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );

      if (!healthResponse.ok) {
        throw new Error("Bridge listener not available");
      }

      // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
      const nearAmount = ethers.utils.parseEther(amount).toString();

      // Create HTLC via bridge listener API
      const response = await fetch(
        `${BRIDGE_CONFIG.listenerApi}/bridges/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "ETH_TO_NEAR",
            amount: nearAmount,
            hashlock: hashlock,
            timelock: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
            ethRecipient: account,
            nearAccount: nearAccount,
            secret: secret,
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );

      const result = await response.json();

      if (result.success) {
        addLog(`✅ NEAR HTLC created manually: ${result.data.bridgeId}`);
        pollBridgeStatus();
      } else {
        addLog(`❌ Failed to create NEAR HTLC: ${result.error}`);
      }
    } catch (error) {
      if (error.name === "TimeoutError" || error.message.includes("timeout")) {
        addLog(`⏰ Request timeout - bridge listener not responding`);
        addLog(`❌ Make sure bridge listener is running on port 3002`);
        addLog(`💡 Start it with: cd bridge-listener && pnpm run dev`);
      } else if (error.message.includes("fetch")) {
        addLog(`🔌 Bridge listener not available - is it running?`);
        addLog(`💡 Start it with: cd bridge-listener && pnpm run dev`);
      } else {
        addLog(`❌ Manual NEAR HTLC creation failed: ${error}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show NEAR CLI command
  const showNearCLICommand = () => {
    const hashlockBytes = Array.from(ethers.utils.arrayify(hashlock));
    const nearAmountYocto = ethers.utils.parseEther(amount).toString();
    const timelock = Date.now() + 24 * 60 * 60 * 1000;

    addLog(`📋 NEAR CLI Command to create HTLC:`);
    addLog(`near call mat-event.testnet create_cross_chain_htlc '{`);
    addLog(`  "receiver": "${nearAccount}",`);
    addLog(`  "hashlock": [${hashlockBytes.join(",")}],`);
    addLog(`  "timelock": ${timelock},`);
    addLog(`  "eth_address": "${account}"`);
    addLog(`}' --accountId mat-event.testnet --amount ${amount}`);
    addLog(``);
    addLog(`💡 Copy this command and run it in your terminal!`);
    addLog(`📝 Your secret: ${secret}`);
    addLog(`🔒 Your hashlock: ${hashlock}`);
  };

  // Create NEAR HTLC automatically (simplified version)
  const createNearHTLCAutomatically = async () => {
    try {
      addLog(`🤖 Auto-creating NEAR HTLC...`);

      // 1️⃣ Préparez les paramètres
      const hashlockBytes = Array.from(ethers.utils.arrayify(hashlock));
      const timelock = Date.now() + 24 * 60 * 60 * 1000; // 24h

      // 2️⃣ Calculez le dépôt en yoctoⓃ (parseNearAmount ne retourne jamais undefined avec un string valide)
      const depositYocto = parseNearAmount(amount)!; // ex. "1.0" → "1000000000000000000000000"

      const nearCallParams = {
        receiver: nearAccount,
        hashlock: hashlockBytes,
        timelock: timelock,
        eth_address: account || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        depositYocto,
      };

      addLog(`📞 Calling NEAR contract with parameters:`);
      addLog(`   Contract: mat-event.testnet`);
      addLog(`   Method:  create_cross_chain_htlc`);
      addLog(
        `   Amount:  ${amount} Ⓝ (${formatNearAmount(depositYocto)} yoctoⓃ)`
      );
      addLog(`   Receiver: ${nearAccount}`);

      // 3️⃣ Essayez la transmission automatique
      try {
        addLog(`🔐 Signing & broadcasting via hybrid CLI generation...`);
        await executeNearTransaction(nearCallParams);
      } catch (txError) {
        addLog(`❌ NEAR transaction failed: ${txError}`);
        addLog(`💡 Fallback: use the NEAR CLI command generated below`);
      }
    } catch (error) {
      addLog(`❌ Auto NEAR HTLC creation failed: ${error}`);
    }
  };

  interface NearTxParams {
    receiver: string;
    hashlock: number[];
    timelock: number;
    eth_address: string;
    depositYocto: string;
  }

  const executeNearTransaction = async (params: NearTxParams) => {
    // 1️⃣ Transformez le hashlock en base64
    const hashlockBase64 = Buffer.from(params.hashlock).toString("base64");
    // 2️⃣ Préparez la commande CLI avec --deposit
    const cliCommand = `near call mat-event.testnet create_cross_chain_htlc '{
  "receiver": "${params.receiver}",
  "hashlock": "${hashlockBase64}",
  "timelock": ${params.timelock},
  "eth_address": "${params.eth_address}"
}' \\
--accountId mat-event.testnet \\
--deposit ${params.depositYocto}`;

    // 3️⃣ Stockez et affichez dans les logs
    setLastGeneratedCommand(cliCommand);
    addLog(
      `📋 NEAR CLI Command Generated (deposit=${formatNearAmount(
        params.depositYocto
      )}Ⓝ):`
    );
    addLog(cliCommand);
  };

  // Connect to bridge events stream
  useEffect(() => {
    // Check if bridge listener is available
    fetch(`${BRIDGE_CONFIG.listenerApi}/health`)
      .then(() => {
        // Bridge listener available, connect to events
        const eventSource = new EventSource(
          `${BRIDGE_CONFIG.listenerApi}/events`
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "bridgeCreated") {
              addLog(`🌉 Bridge created: ${data.data.id} (${data.data.type})`);
              pollBridgeStatus();
            } else if (data.type === "bridgeCompleted") {
              addLog(`✅ Bridge completed: ${data.data.id}`);
              pollBridgeStatus();
            }
          } catch (error) {
            console.error("Error parsing SSE event:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE connection error:", error);
        };

        return () => {
          eventSource.close();
        };
      })
      .catch(() => {
        addLog("⚠️ Bridge listener not available - manual mode only");
      });
  }, []);

  // Auto-poll bridge status
  useEffect(() => {
    const interval = setInterval(pollBridgeStatus, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">
        ETH ↔ NEAR Bridge (1inch Integration)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel */}
        <div className="space-y-6">
          {/* Wallet Connection */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
            {!account ? (
              <div className="space-y-2">
                <Button onClick={connectWallet} className="w-full">
                  Connect MetaMask
                </Button>
                <div className="text-center text-sm text-gray-500">or</div>
                <Button
                  onClick={connectWithForkKey}
                  className="w-full"
                  variant="outline"
                >
                  Use Fork Account (Test)
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Fork account has 10k ETH for testing
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Connected: {account}</p>
                <p className="text-sm text-gray-600">Network: Fork Mainnet</p>
                <p className="text-sm text-gray-600">
                  Bridge: {BRIDGE_CONFIG.contractAddress}
                </p>
              </div>
            )}
          </Card>

          {/* Bridge Configuration */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Bridge Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount (ETH)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border rounded"
                  step="0.1"
                  min="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  NEAR Account
                </label>
                <input
                  type="text"
                  value={nearAccount}
                  onChange={(e) => setNearAccount(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="mat-event.testnet"
                />
              </div>

              <div className="space-y-2">
                <Button
                  onClick={generateSecretAndHash}
                  className="w-full"
                  variant="outline"
                >
                  Generate Secret & Hashlock
                </Button>
                {secret && (
                  <div className="space-y-2 text-xs">
                    <p>
                      <strong>Secret:</strong> {secret.substring(0, 20)}...
                    </p>
                    <p>
                      <strong>Hashlock:</strong> {hashlock.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={createBridge}
                disabled={!contract || isLoading || !secret}
                className="w-full"
              >
                {isLoading
                  ? "Creating Bridge..."
                  : `Bridge ${amount} ETH → NEAR`}
              </Button>

              <Button
                onClick={createNearHTLCManually}
                disabled={!secret || !hashlock || isLoading}
                className="w-full mt-2"
                variant="outline"
              >
                {isLoading
                  ? "Creating NEAR HTLC..."
                  : "Create NEAR HTLC Manually"}
              </Button>

              <Button
                onClick={showNearCLICommand}
                disabled={!secret || !hashlock}
                className="w-full mt-2"
                variant="secondary"
              >
                Show NEAR CLI Command
              </Button>
            </div>
          </Card>

          {/* Bridge Status */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Active Bridges</h2>
              <Button onClick={checkNearContract} size="sm" variant="outline">
                Check NEAR
              </Button>
            </div>
            <div className="space-y-2">
              {bridgeEvents.length === 0 ? (
                <p className="text-gray-500">No active bridges</p>
              ) : (
                bridgeEvents.map((bridge) => (
                  <div key={bridge.id} className="border p-3 rounded">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{bridge.type}</p>
                        <p className="text-sm text-gray-600">
                          {ethers.utils.formatEther(bridge.amount)} ETH
                        </p>
                        <p className="text-sm text-gray-600">
                          Status: {bridge.status}
                        </p>
                      </div>
                      {bridge.status === "PENDING" &&
                        bridge.type === "ETH_TO_NEAR" && (
                          <Button
                            size="sm"
                            onClick={() => completeBridge(bridge.id)}
                          >
                            Complete
                          </Button>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Logs Panel */}
        <div>
          <Card className="p-6 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Bridge Logs</h2>
              <div className="flex gap-2">
                {lastGeneratedCommand && (
                  <Button onClick={copyCLICommand} size="sm" variant="default">
                    Copy CLI Cmd
                  </Button>
                )}
                <Button onClick={clearLogs} size="sm" variant="outline">
                  Clear
                </Button>
              </div>
            </div>
            <div
              className="bg-black text-green-400 p-4 rounded font-mono text-xs h-96 overflow-y-auto"
              style={{ fontFamily: "monospace" }}
            >
              {logs.length === 0 ? (
                <p>Ready to bridge... 🌉</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Instructions */}
      <Card className="mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">
          How to Use the Hybrid Bridge
        </h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>1.</strong> Connect your wallet to the fork mainnet (or use
            "Use Fork Account")
          </p>
          <p>
            <strong>2.</strong> Generate a secret and hashlock
          </p>
          <p>
            <strong>3.</strong> Click "Bridge ETH → NEAR" - ETH will be bridged
            automatically
          </p>
          <p>
            <strong>4.</strong> Click "COMPLETE" to finalize the bridge with the
            secret
          </p>
        </div>
      </Card>
    </div>
  );
}
