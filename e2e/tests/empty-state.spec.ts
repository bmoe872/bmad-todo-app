// UJ-3 / FR-6 — the empty List is a calm state, not a blank void. The app frame
// + add-input still render and the exact empty microcopy shows.

import { COPY } from './support/app';
import { test, expect } from './support/fixtures';

test.describe('Empty state (FR-6, UJ-3)', () => {
  test('an empty list shows the calm empty message with the frame + input intact', async ({
    orbit,
    page,
  }) => {
    // cleanState fixture already emptied the List via the API.
    await page.goto('/');
    await orbit.waitForListReady();

    await expect(orbit.emptyState).toBeVisible();
    await expect(orbit.emptyState).toHaveText(COPY.emptyState);
    await expect(orbit.rows).toHaveCount(0);

    // Not a blank void: the panel title + add-input are present and usable.
    await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
    await expect(orbit.addInput).toBeVisible();
    await expect(orbit.addInput).toHaveAttribute('placeholder', COPY.addPlaceholder);

    // Adding an item transitions out of the empty state.
    await orbit.addTodo('First thing');
    await expect(orbit.emptyState).toHaveCount(0);
    await expect(orbit.row('First thing')).toBeVisible();
  });
});
