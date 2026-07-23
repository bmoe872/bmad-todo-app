import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest (unit/component) config. Coverage uses the v8 provider with branch
// coverage enabled and an ENFORCING >=70% branch gate on the meaningful set
// (Story 6.2). `vitest run --coverage` exits non-zero if the branch threshold
// is not met.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Process CSS imports so the design tokens are actually injected into the
    // jsdom document and resolvable via getComputedStyle — this lets the
    // dark-only token layer be asserted as *applied*, not just present on disk.
    css: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html'],
      // Report every source file (not just those touched by a test) so the
      // report reflects true coverage. The v8 provider always collects branch
      // coverage.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // ENFORCING gate (Story 6.2): fail the run if BRANCH coverage of the
      // meaningful set (the `include` above minus `exclude` below) drops below
      // 70%. The "meaningful coverage" definition (epics Open Question #4) is
      // measured as branch coverage, so branches is the authoritative gate.
      thresholds: {
        branches: 70,
      },
      // Meaningful-coverage exclusions: entrypoint, type-only modules, tests,
      // and the three.js scene itself — device-dependent WebGL rendering code
      // (cube density / DPR caps / render loop) that jsdom cannot exercise, not
      // business logic. NOTE: only `scene.ts` is excluded from the backdrop
      // layer; the PURE degradation-ladder decision logic (`degradation.ts`),
      // the React host (`Backdrop.tsx`) and the error boundary
      // (`BackdropBoundary.tsx`) ARE covered — that fallback/watchdog DECISION
      // logic is business logic and is unit-tested (Story 4.2).
      exclude: [
        'src/main.tsx',
        'src/types.ts',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/test-utils.tsx',
        'src/backdrop/scene.ts',
      ],
    },
  },
});
