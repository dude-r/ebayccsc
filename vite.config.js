import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built site works when hosted from any sub-path
// (GitHub Pages project sites, static file servers, double-clicked dist, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
})
