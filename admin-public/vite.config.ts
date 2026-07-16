import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/oauth': {
        target: 'http://39.105.100.46:8080',
        changeOrigin: true,
      },
    },
  },
})
