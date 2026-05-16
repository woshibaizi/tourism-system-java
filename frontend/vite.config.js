import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/agent': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-map';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
})
