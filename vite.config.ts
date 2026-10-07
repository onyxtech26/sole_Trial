import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: '0.0.0.0' },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 900 kB of PDF/spreadsheet code lives behind dynamic imports in
    // utils/exports.ts and utils/viator.ts, so it never lands in the first
    // paint. Naming those libraries in manualChunks would defeat that — Rollup
    // promotes named chunks to static dependencies and Vite then preloads them.
    // Only the always-needed vendors are split by hand.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'motion'],
        },
      },
    },
  },
});
