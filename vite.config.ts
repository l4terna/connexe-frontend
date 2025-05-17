import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3001,
    open: true,
    https: {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem'),
    },
    proxy: {
      '/api': {
        target: 'http://192.168.0.66:8080',
        changeOrigin: true,
        secure: false,
        ws: false,
        cookieDomainRewrite: 'localhost',
      },
      '/ws': {
        target: 'http://192.168.0.66:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    },
  },
}); 