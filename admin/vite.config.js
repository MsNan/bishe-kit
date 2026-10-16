import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const API = process.env.API_URL || 'http://localhost:3000'
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, proxy: { '/api': API, '/uploads': API } },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
})
