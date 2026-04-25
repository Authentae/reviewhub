/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          axios: ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  // Vitest config lives here so there's a single source of truth for both
  // dev server and tests. jsdom gives us `document`, `window`, and friends.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    // Keep output tight — our tests are mostly render + assertion
    reporters: ['default'],
    // Exclude the dist/ build artefacts and node_modules from test discovery
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
});
