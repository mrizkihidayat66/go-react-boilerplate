import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies API calls to the Go backend, so the SPA talks to
// /api/* as in production (same origin) — no CORS needed in either mode.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
      '/healthz': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: '../internal/webui/dist',
    emptyOutDir: true,
    // The admin shell (React, router, query, forms, zod, UI primitives)
    // legitimately weighs ~570 kB raw / ~180 kB gzipped; the heavy
    // feature pages are code-split below this threshold. Raise the
    // ceiling only if the entry chunk itself grows past this.
    chunkSizeWarningLimit: 650,
  },
})
