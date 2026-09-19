import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local/default: '/'. GitHub Pages project site: VITE_BASE=/wine-varietal-map/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
