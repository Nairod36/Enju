/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 1inch Fusion+ Configuration
  readonly VITE_FUSION_AUTH_KEY: string
  readonly VITE_FUSION_PROXY_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}