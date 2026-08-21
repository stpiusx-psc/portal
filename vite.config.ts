import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` is overridable so the same build works on GitHub Pages
// (served from /<repo>/) and on a custom domain (served from /).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  build: { outDir: 'dist', sourcemap: false },
})
