import { useState } from "react";
import { Button } from "../ui/button";
import { useAccount } from "wagmi";
import { Coins, Loader2, Zap } from "lucide-react";

export function MintEthButton() {
  const { address, isConnected } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);

  const handleMintEth = async () => {
    if (!address || !isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsMinting(true);
    console.log("🔄 Minting ETH...");
    try {
      const response = await fetch(
        "http://localhost:3001/api/v1/rpc/mint-eth",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: address,
            // amount is optional, defaults to 0.1 ETH
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        alert(
          `Successfully minted ${result.data.amount} ETH to your wallet!\nTransaction: ${result.data.txHash}`
        );
      } else {
        console.error("Minting failed:", result.error);
      }
    } catch (error) {
      console.error("Mint error:", error);
      alert("Network error: Failed to connect to mint service");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <Button
      onClick={handleMintEth}
      disabled={mintLoading}
      variant="outline"
      size="sm"
      className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-cyan-100 hover:border-blue-300 transition-all duration-200 font-medium"
    >
      {mintLoading ? (
        <>
          <Zap className="w-4 h-4 mr-2 animate-pulse" />
          Minting...
        </>
      ) : (
        <>
          <Zap className="w-4 h-4 mr-2" />
          Get 0.1 ETH
        </>
      )}
    </Button>
  );
}
