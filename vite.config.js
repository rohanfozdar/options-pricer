import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure assets load correctly when the app is served from /options-pricer/ on GitHub Pages
  base: '/options-pricer/',
  server: {
    port: 3000,
    open: true
  }
})
