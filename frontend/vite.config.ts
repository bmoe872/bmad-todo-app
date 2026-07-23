import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite config for the SPA. The dev server / preview server is what the Epic 1
// Playwright smoke targets (a locally-served page, NOT docker-compose).
//
// `server.host: true` binds 0.0.0.0 so the dev-server port is reachable from
// the host browser when the server runs inside a container (Story 5.3 `dev`
// compose profile). File-watch polling is opt-in via VITE_DEV_POLLING=1: bind
// mounts on Docker Desktop (macOS/Windows) don't deliver native inotify events
// reliably, so HMR needs polling there — but polling wastes CPU for a plain
// local `npm run dev`, so it stays off unless the flag is set.
const usePolling = process.env.VITE_DEV_POLLING === '1';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: usePolling ? { usePolling: true } : undefined,
  },
  preview: {
    port: 4173,
  },
});
