// FR-7 — load + action error paths with reconcile. Faults are injected by
// aborting the specific network call (the deterministic way to force a failure);
// the recovery/retry then hits the REAL backend, so reconcile is genuine.

import { COPY } from './support/app';
import { createTodo, listTodos } from './support/api';
import { test, expect } from './support/fixtures';

test.describe('Error paths with reconcile (FR-7)', () => {
  test('load error: inline error + Retry, app never crashes, then reconciles', async ({
    orbit,
    page,
    request,
  }) => {
    await createTodo(request, 'Survives the outage');

    // Fail ONLY the initial list GET.
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // The frame + input still render (app never crashes); inline load error shows.
    await expect(page.getByText(COPY.loadError)).toBeVisible();
    await expect(page.getByRole('button', { name: COPY.retry })).toBeVisible();
    await expect(orbit.addInput).toBeVisible();

    // Remove the fault and retry → the real list loads (reconcile).
    await page.unroute('**/api/todos');
    await page.getByRole('button', { name: COPY.retry }).click();

    await orbit.waitForListReady();
    await expect(orbit.row('Survives the outage')).toBeVisible();
    await expect(page.getByText(COPY.loadError)).toHaveCount(0);
  });

  test('action error: optimistic toggle rolls back in place with an inline error', async ({
    orbit,
    page,
    request,
  }) => {
    await createTodo(request, 'Toggle me');
    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.checkbox('Toggle me')).not.toBeChecked();

    // Fail the toggle PATCH only.
    await page.route('**/api/todos/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await orbit.toggle('Toggle me');

    // Rolls back in place + non-blocking inline error near the row.
    await expect(orbit.row('Toggle me').getByText(COPY.actionError)).toBeVisible();
    await expect(orbit.checkbox('Toggle me')).not.toBeChecked();
    await expect(orbit.rows).toHaveCount(1);

    // Reconciles to true server state (still incomplete).
    await page.unroute('**/api/todos/*');
    const todos = await listTodos(request);
    expect(todos.find((t) => t.description === 'Toggle me')?.completed).toBe(false);
  });
});
