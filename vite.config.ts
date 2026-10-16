import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.CLIENT_PORT ?? 5173),
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
  },
});
