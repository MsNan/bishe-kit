import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import App from './App.vue'
import { setupLoginGuard } from './utils/guard.js'

export function createApp() {
  const app = createSSRApp(App)
  app.use(Pinia.createPinia())
  setupLoginGuard()
  return { app, Pinia }
}
