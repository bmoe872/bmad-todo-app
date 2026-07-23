// UJ-1 / FR-1 — create a Todo. Proves the optimistic create appears instantly at
// the TOP of the List, the field clears + refocuses, and the write persists to
// the real backend (reconcile after reload).

import { listTodos } from './support/api';
import { test, expect } from './support/fixtures';

test.describe('Create a todo (FR-1, UJ-1)', () => {
  test('a new todo appears optimistically at the top, field clears, and it persists', async ({
    orbit,
    page,
    request,
  }) => {
    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.emptyState).toBeVisible();

    await orbit.addTodo('Buy oat milk');

    // Optimistic: the row shows and the input clears + keeps focus.
    await expect(orbit.row('Buy oat milk')).toBeVisible();
    await expect(orbit.addInput).toHaveValue('');
    await expect(orbit.addInput).toBeFocused();

    // Newest-first ordering: fire two more; the last created sits at the top.
    await orbit.addTodo('Email the landlord');
    await orbit.addTodo('Renew library card');
    await expect(orbit.rows).toHaveCount(3);
    await expect(orbit.rows.nth(0)).toContainText('Renew library card');
    await expect(orbit.rows.nth(2)).toContainText('Buy oat milk');

    // Reconcile: the backend persisted all three (survives a reload).
    await page.reload();
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);
    await expect(orbit.rows.nth(0)).toContainText('Renew library card');

    const persisted = await listTodos(request);
    expect(persisted.map((t) => t.description)).toEqual([
      'Renew library card',
      'Email the landlord',
      'Buy oat milk',
    ]);
  });

  test('empty / whitespace-only input is blocked client-side with no request', async ({
    orbit,
    page,
    request,
  }) => {
    await page.goto('/');
    await orbit.waitForListReady();

    await orbit.addInput.fill('   ');
    await orbit.addInput.press('Enter');

    await expect(page.getByText('Type something first.')).toBeVisible();
    await expect(orbit.rows).toHaveCount(0);
    expect(await listTodos(request)).toHaveLength(0);
  });
});
