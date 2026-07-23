import { defineConfig, devices } from '@playwright/test';

// Epic 1 Playwright config: the smoke run targets a simple LOCALLY-SERVED page
// (Vite preview of the built frontend), NOT docker-compose. The compose-backed
// run and full-journey E2E suite land in Epic 5 (stack) and Epic 6 (journeys).
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Build the SPA once, then serve the static build with `vite preview`.
  webServer: {
    command: 'npm --prefix ../frontend run build && npm --prefix ../frontend run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
