/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROJECT_ID: string
  readonly VITE_FUSION_AUTH_KEY: string
  readonly VITE_FUSION_PROXY_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
