import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': backend,
      '/proxy': backend,
      '/videoplayback': backend,
      '/latest_version': backend,
      '/health': backend,
      '/debug': backend
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true
  }
});
