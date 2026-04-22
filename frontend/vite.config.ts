import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/cv': 'http://localhost:8000',
      '/analyze': 'http://localhost:8000',
      '/interview': 'http://localhost:8000',
    },
  },
})
