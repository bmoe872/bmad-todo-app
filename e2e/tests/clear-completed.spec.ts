// UJ-4 / FR-9, AD-7 — clear completed + undo, with the DEFERRED-COMMIT model:
//   - clear() hides completed rows optimistically and opens the ~6s Undo toast;
//     NOTHING is deleted server-side yet (AD-7).
//   - on dismiss (toast auto-expires) exactly one DELETE /api/todos/completed
//     fires and the List reconciles to server truth.
//   - Undo is a pure client-side timer cancel with NO server call; cleared rows
//     return to their prior positions/states.

import { listTodos, seedTodos, setCompleted } from './support/api';
import { test, expect } from './support/fixtures';

test.describe('Clear completed + undo (FR-9, AD-7, UJ-4)', () => {
  test('clear hides completed optimistically, keeps active, then commits on dismiss', async ({
    orbit,
    page,
    request,
  }) => {
    const [a, b] = await seedTodos(request, ['Active one', 'Done A', 'Done B']);
    // Complete "Done A" and "Done B" (a = Active one stays active).
    const seeded = await listTodos(request);
    for (const t of seeded) {
      if (t.description.startsWith('Done')) await setCompleted(request, t.id, true);
    }
    void a;
    void b;

    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);

    await orbit.clearCompletedButton.click();
    // Move the pointer away so it never hovers the toast (hover pauses the timer).
    await page.mouse.move(0, 0);

    // Optimistic: completed rows vanish, active row stays, toast announces 2.
    await expect(orbit.undoToast).toBeVisible();
    await expect(orbit.undoToast).toContainText('Cleared 2 completed.');
    await expect(orbit.rows).toHaveCount(1);
    await expect(orbit.row('Active one')).toBeVisible();

    // Deferred commit: while the toast is up the server has NOT deleted yet.
    expect(await listTodos(request)).toHaveLength(3);

    // Let the ~6s window expire → single DELETE fires → reconcile.
    await expect(orbit.undoToast).toBeHidden({ timeout: 12_000 });
    await expect(async () => {
      const todos = await listTodos(request);
      expect(todos.map((t) => t.description)).toEqual(['Active one']);
    }).toPass();

    await page.reload();
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(1);
    await expect(orbit.row('Active one')).toBeVisible();
  });

  test('undo restores cleared rows and fires no server delete', async ({
    orbit,
    page,
    request,
  }) => {
    await seedTodos(request, ['Stay active', 'Finished A', 'Finished B']);
    const seeded = await listTodos(request);
    for (const t of seeded) {
      if (t.description.startsWith('Finished')) {
        await setCompleted(request, t.id, true);
      }
    }

    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);

    await orbit.clearCompletedButton.click();
    await page.mouse.move(0, 0);
    await expect(orbit.undoToast).toBeVisible();
    await expect(orbit.rows).toHaveCount(1);

    // Undo within the window → all restored to prior positions/states.
    await orbit.undoButton.click();
    await expect(orbit.undoToast).toBeHidden();
    await expect(orbit.rows).toHaveCount(3);
    await expect(orbit.checkbox('Finished A')).toBeChecked();
    await expect(orbit.checkbox('Finished B')).toBeChecked();
    await expect(orbit.checkbox('Stay active')).not.toBeChecked();

    // Nothing was deleted server-side (Undo is client-only, AD-7).
    expect(await listTodos(request)).toHaveLength(3);

    await page.reload();
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);
  });
});
