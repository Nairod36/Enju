/**
 * Configuration centralisée pour l'intégration Fusion+
 */

export const FUSION_CONFIG = {
  apiUrl: import.meta.env.VITE_FUSION_PROXY_URL || "https://1inch-vercel-proxy-six.vercel.app",
  authKey: import.meta.env.VITE_FUSION_AUTH_KEY || "",
};