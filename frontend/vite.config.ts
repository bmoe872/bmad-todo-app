import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite config for the SPA. The dev server / preview server is what the Epic 1
// Playwright smoke targets (a locally-served page, NOT docker-compose).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
