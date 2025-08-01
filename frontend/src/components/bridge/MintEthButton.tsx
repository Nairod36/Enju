import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useAccount } from "wagmi";
import { Coins, Loader2 } from "lucide-react";

export function MintEthButton() {
  const { address, isConnected } = useAccount();
  const [isMinting, setIsMinting] = useState(false);

  const handleMintEth = async () => {
    if (!address || !isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsMinting(true);
    try {
      const response = await fetch('http://localhost:3002/api/mint-eth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          // amount is optional, defaults to 0.1 ETH
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully minted ${result.data.amount} ETH to your wallet!\nTransaction: ${result.data.txHash}`);
      } else {
        alert(`Mint failed: ${result.error || "Unknown error occurred"}`);
      }
    } catch (error) {
      console.error('Mint error:', error);
      alert("Network error: Failed to connect to mint service");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <Card className="w-full bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Coins className="w-5 h-5" />
          Test ETH Faucet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Get 0.1 ETH for testing the bridge on our local fork network.
          </p>
          
          {!isConnected ? (
            <Button disabled className="w-full">
              Connect Wallet First
            </Button>
          ) : (
            <Button
              onClick={handleMintEth}
              disabled={isMinting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isMinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Get 0.1 ETH
                </>
              )}
            </Button>
          )}
          
          <div className="text-xs text-gray-500 border-t pt-2">
            <div>Connected: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'None'}</div>
            <div className="mt-1">Network: Ethereum Fork (Local)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
