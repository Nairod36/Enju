import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  arbitrum,
  sepolia,
  defineChain,
} from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

// Get projectId from https://cloud.reown.com
export const projectId =
  import.meta.env.VITE_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694"; // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const metadata = {
  name: "AppKit",
  description: "AppKit Example",
  url: "https://reown.com", // origin must match your domain & subdomain
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// Custom forked mainnet network using defineChain
export const forkedMainnet: AppKitNetwork = defineChain({
  id: 1, // Keep mainnet ID for fork compatibility
  caipNetworkId: "eip155:1",
  chainNamespace: "eip155",
  name: "🧪 Fork VPS (Test)",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://vps-b11044fd.vps.ovh.net/rpc"],
      webSocket: [],
    },
    public: {
      http: ["https://vps-b11044fd.vps.ovh.net/rpc"],
      webSocket: [],
    },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" },
  },
  contracts: {},
  testnet: false, // Fork of mainnet
});

// for custom networks visit -> https://docs.reown.com/appkit/react/core/custom-networks
export const networks = [mainnet, arbitrum, sepolia, forkedMainnet] as [
  AppKitNetwork,
  ...AppKitNetwork[]
];

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;
