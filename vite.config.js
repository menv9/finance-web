import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow any ngrok / cloudflare quick-tunnel subdomain when sharing the dev server.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.trycloudflare.com'],
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
