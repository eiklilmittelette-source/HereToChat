import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    https: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', secure: false, changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', secure: false, changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true, secure: false, changeOrigin: true }
    }
  }
});
