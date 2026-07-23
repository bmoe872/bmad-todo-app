// Shared test helper: render a component inside a fresh QueryClientProvider so
// `useTodos` (and later mutation hooks) work in component tests. Each call gets
// an isolated QueryClient with retries off, matching the app's manual-retry UX
// and keeping error states deterministic.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
}

export function renderWithClient(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper }) };
}
