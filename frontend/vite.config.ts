import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
        ws: true, // the WebSocket at /api/ws goes through the same proxy as the REST API
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
