import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail instead of moving to 5174 (WEB_URL in .env expects 5173)
    // The browser only ever talks to Vite (localhost:5173). Requests to /api/*
    // are forwarded to Fastify with the /api prefix removed:
    //   /api/flights  ->  http://localhost:3000/flights
    // Same origin means no CORS, and the session cookie is sent automatically.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
