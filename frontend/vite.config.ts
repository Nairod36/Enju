import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files from the root directory
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  
  return {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      port: 5173
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173
  },
  define: {
    // Expose env variables to the frontend
    'process.env': env
  }
  }
})
