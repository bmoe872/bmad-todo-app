// FR-3 — delete a Todo. Proves the delete affordance removes the row optimistically
// (permanent, no undo) while other rows remain, and that the deletion persists.

import { listTodos, seedTodos } from './support/api';
import { test, expect } from './support/fixtures';

test.describe('Delete a todo (FR-3)', () => {
  test('deleting a row removes it optimistically, leaves the rest, and persists', async ({
    orbit,
    page,
    request,
  }) => {
    await seedTodos(request, ['Keep me', 'Delete me']);
    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(2);

    await orbit.deleteButton('Delete me').click();

    // Optimistic removal; the other row survives.
    await expect(orbit.row('Delete me')).toHaveCount(0);
    await expect(orbit.row('Keep me')).toBeVisible();
    await expect(orbit.rows).toHaveCount(1);

    // Persisted server-side.
    await expect(async () => {
      const todos = await listTodos(request);
      expect(todos.map((t) => t.description)).toEqual(['Keep me']);
    }).toPass();

    // Reconcile after reload.
    await page.reload();
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(1);
    await expect(orbit.row('Keep me')).toBeVisible();
  });
});
