import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Local dev: no base path (served at root)
  // Production build: use /options-pricer/ for GitHub Pages
  base: process.env.NODE_ENV === 'production' ? '/options-pricer/' : '/',
  server: {
    port: 3000,
    open: true
  }
})
