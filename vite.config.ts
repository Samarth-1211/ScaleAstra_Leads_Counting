import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Windows reserves Vite's default port (5173) on some machines, so use one that's free.
  server: { host: '127.0.0.1', port: 3456 },
  preview: { host: '127.0.0.1', port: 3457 },
});
