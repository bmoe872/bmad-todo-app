import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest (unit/component) config. Coverage uses the v8 provider with branch
// coverage enabled. The gate is REPORT-ONLY at this stage; the enforcing
// >=70% meaningful-coverage gate lands in Story 6.2.
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
      // coverage. Gate stays report-only until Story 6.2.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // Meaningful-coverage exclusions: entrypoint, type-only modules, tests,
      // and three.js backdrop visual tuning (cube density / DPR caps, added in
      // Epic 4) which is device-dependent rendering code, not business logic.
      exclude: [
        'src/main.tsx',
        'src/types.ts',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/test-utils.tsx',
        'src/backdrop/**',
      ],
    },
  },
});
