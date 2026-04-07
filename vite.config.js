import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Chunk splitting manual: separa vendor pesados para mejor caché
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) return 'vendor-react';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (
            id.includes('node_modules/html2pdf') ||
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/file-saver')
          ) return 'vendor-export';
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-toastify') ||
            id.includes('node_modules/react-select')
          ) return 'vendor-ui';
        },
      },
    },
    // Aumentar límite de aviso para evitar spam en consola
    chunkSizeWarningLimit: 600,
  },
})
