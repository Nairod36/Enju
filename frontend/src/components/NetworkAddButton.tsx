import { Button } from "./ui/button";
import { Plus } from "lucide-react";

export function NetworkAddButton() {
  const configureVpsRpc = async () => {
    if (!window.ethereum) {
      alert("MetaMask n'est pas installé !");
      return;
    }

    console.log("🔄 Configuration du réseau VPS...");

    await (window.ethereum as any).request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });
    console.log("✅ Connecté au réseau Ethereum (ChainId: 1)");

    // Informer l'utilisateur de configurer manuellement le RPC
    await (window.ethereum as any).request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x1",
          chainName: "Ethereum Mainnet (VPS)",
          rpcUrls: ["https://vps-b11044fd.vps.ovh.net/rpc"], // ✅ Array
          nativeCurrency: {
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
          },
        },
      ],
    });
  };

  return (
    <div className="flex gap-2">
      {/* Bouton pour guider la configuration RPC VPS */}
      <Button
        onClick={configureVpsRpc}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 text-xs font-medium"
      >
        <Plus className="w-3 h-3" />
        Add custom RPC
      </Button>
    </div>
  );
}
