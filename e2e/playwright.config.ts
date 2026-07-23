import { defineConfig, devices } from '@playwright/test';

// Story 6.1 — the REAL end-to-end suite. Unlike the Epic-1 smoke config (which
// built the SPA and served it with `vite preview`), this run targets a FULLY
// COMPOSED, RUNNING stack (nginx frontend + FastAPI backend + Postgres) reached
// through the single origin at E2E_BASE_URL. The stack is brought up and torn
// down OUT OF BAND by the Makefile (`make e2e` → an isolated `docker compose`
// project on its own ports/volume), NOT by a Playwright-managed `webServer` —
// so teardown reliably removes the containers/volume and the tests exercise the
// real nginx `/api` reverse-proxy end to end (AD-10).
//
// Default target is http://localhost:8090 — the ISOLATED e2e stack's frontend
// port (see Makefile), deliberately distinct from the human's live inspection
// stack on :8080.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8090';

export default defineConfig({
  testDir: './tests',
  // The app is a single implicit global List with no auth and no per-test data
  // partition, so specs share one server-side List. Run SERIALLY (one worker,
  // no intra-file parallelism) and reset state before each test (see
  // tests/support/fixtures.ts) to keep every spec deterministic and isolated.
  fullyParallel: false,
  workers: 1,
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
      use: {
        ...devices['Desktop Chrome'],
        // Force software WebGL (SwiftShader) so the real three.js Backdrop scene
        // actually initializes under headless Chromium — the accessibility gate
        // must run with the Backdrop ACTIVE, not silently fallen back to the CSS
        // gradient (closes the axe-with-backdrop item deferred from Epics 3/4).
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--ignore-gpu-blocklist',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
  ],
});
