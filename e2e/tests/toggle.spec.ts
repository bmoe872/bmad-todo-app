// UJ-2 / FR-2, FR-5 — complete a Todo and toggle it back. Proves the checkbox
// toggles completion optimistically and restyles IN PLACE (never reorders /
// removes), in both directions, and that the state persists to the backend.

import { listTodos, seedTodos } from './support/api';
import { test, expect } from './support/fixtures';

test.describe('Complete / toggle-back a todo (FR-2, FR-5, UJ-2)', () => {
  test('checkbox completes in place, toggles back in place, and persists', async ({
    orbit,
    page,
    request,
  }) => {
    // Seed three so we can assert the toggled row keeps its position.
    await seedTodos(request, ['First task', 'Second task', 'Third task']);
    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);

    // Newest-first: [Third, Second, First]. Toggle the middle one.
    const middleRow = orbit.row('Second task');
    await expect(middleRow).toHaveAttribute('data-completed', 'false');

    await orbit.toggle('Second task');

    // Restyled completed IN PLACE — still the middle row, still 3 rows.
    await expect(middleRow).toHaveAttribute('data-completed', 'true');
    await expect(orbit.checkbox('Second task')).toBeChecked();
    await expect(orbit.rows).toHaveCount(3);
    await expect(orbit.rows.nth(1)).toContainText('Second task');

    // Persisted server-side.
    await expect(async () => {
      const todos = await listTodos(request);
      const second = todos.find((t) => t.description === 'Second task');
      expect(second?.completed).toBe(true);
    }).toPass();

    // Toggle back — returns to active in place (FR-2 both directions, FR-5).
    await orbit.toggle('Second task');
    await expect(middleRow).toHaveAttribute('data-completed', 'false');
    await expect(orbit.checkbox('Second task')).not.toBeChecked();
    await expect(orbit.rows.nth(1)).toContainText('Second task');

    // Reconcile after reload.
    await page.reload();
    await orbit.waitForListReady();
    await expect(orbit.checkbox('Second task')).not.toBeChecked();
    const finalTodos = await listTodos(request);
    expect(finalTodos.find((t) => t.description === 'Second task')?.completed).toBe(
      false,
    );
  });
});
