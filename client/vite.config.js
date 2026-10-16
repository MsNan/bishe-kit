import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
const API = process.env.API_URL || 'http://localhost:3000'
export default defineConfig({
  plugins: [uni()],
  server: { port: 5174, proxy: { '/api': API, '/uploads': API } },
})
