import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Chart library (used by admin/results only)
          'vendor-charts': ['recharts'],

          // Game engine (large, stable)
          'game-engine': ['./src/engine/gameEngine'],

          // Admin bundle (lazy-loaded)
          'admin': [
            './src/pages/AdminPage',
            './src/pages/EducatorDashboardPage',
            './src/pages/EducatorGameView',
            './src/pages/CreateGamePage',
          ],

          // Large components
          'components-heavy': [
            './src/components/FinancialReport',
            './src/components/DecisionSimulator',
          ],

          // Minsky economic modeler (lazy-loaded)
          'minsky': [
            './src/engine/minskyEngine',
            './src/engine/minskyModels',
            './src/pages/MinskyLabPage',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500, // Warn if chunk exceeds 500KB
  },
})
