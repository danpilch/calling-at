import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Served from https://danpilch.github.io/calling-at/ (GitHub Pages project site).
  base: '/calling-at/',
  plugins: [react()],
})
