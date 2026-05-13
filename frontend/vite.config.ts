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
      '/jobs': 'http://localhost:8000',
      '/recruiter': 'http://localhost:8000',
      '/referrals': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/roadmap': 'http://localhost:8000',
      '/subscriptions': 'http://localhost:8000',
      '/payments': 'http://localhost:8000',
    },
  },
})
