// Test harness: a `test` that auto-resets the shared global List to EMPTY before
// every spec (via the real API) so each test is deterministic and independent,
// and exposes an `orbit` Page Object. Import `test`/`expect` from here instead
// of '@playwright/test'.

import { test as base, expect } from '@playwright/test';

import { resetState } from './api';
import { OrbitPage } from './app';

export const test = base.extend<{ orbit: OrbitPage; cleanState: void }>({
  // Auto fixture: runs before each test. Uses the API-only `request` context
  // (no navigation) so it never interferes with per-test route mocking.
  //
  // WARNING: resetState() is DESTRUCTIVE — it deletes every Todo at the target
  // origin. This suite is built to run ONLY against a disposable, isolated stack
  // (the `make e2e` compose project on :8090, the config's default baseURL).
  // Never point E2E_BASE_URL at a stack whose data you care about.
  cleanState: [
    async ({ request }, use) => {
      await resetState(request);
      await use();
    },
    { auto: true },
  ],

  orbit: async ({ page }, use) => {
    await use(new OrbitPage(page));
  },
});

export { expect };
