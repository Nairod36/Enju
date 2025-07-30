import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy 1inch API calls to avoid CORS issues
      '/api/1inch': {
        target: 'https://api.1inch.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/1inch/, ''),
        headers: {
          'Origin': 'https://api.1inch.dev',
        },
      },
      // Proxy local Ethereum fork for development
      '/api/eth': {
        target: 'http://vps-b11044fd.vps.ovh.net:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eth/, ''),
      },
    },
  },
})
