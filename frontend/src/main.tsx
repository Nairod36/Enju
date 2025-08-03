import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { router } from "./router";
import { projectId, metadata, networks, wagmiAdapter } from "./config";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
import "./App.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { WalletSelectorProvider } from "@near-wallet-selector/react-hook";

const walletSelectorConfig = {
  network: "testnet",
  debug: true,
  modules: [setupMyNearWallet(), setupMeteorWallet()],
  walletUrls: {
    "my-near-wallet": "https://testnet.mynearwallet.com/",
    "meteor-wallet": "https://meteormallet.app/",
  },
};

const queryClient = new QueryClient();

const generalConfig = {
  projectId,
  networks,
  metadata,
  themeMode: "light" as const,
  themeVariables: {
    "--w3m-accent": "#000000",
  },
};

// Create modal
createAppKit({
  adapters: [wagmiAdapter],
  ...generalConfig,
  features: {
    analytics: true,
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletSelectorProvider config={walletSelectorConfig}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <RouterProvider router={router} />
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </WalletSelectorProvider>
  </StrictMode>
);
