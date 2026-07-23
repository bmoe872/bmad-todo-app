// SM-4 / NFR-A11y — the automated accessibility gate. Asserts ZERO critical
// WCAG 2.1 AA violations with the three.js BACKDROP ACTIVE (closing the item
// deferred from Epics 3/4), on both the loaded and loaded-empty states, plus a
// keyboard-only walk of the loop and a reduced-motion functional check (FR-8).

import AxeBuilder from '@axe-core/playwright';

import { seedTodos, setCompleted, listTodos } from './support/api';
import { test, expect } from './support/fixtures';
import { OrbitPage } from './support/app';

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function assertBackdropActive(orbit: OrbitPage, page: import('@playwright/test').Page) {
  // The decorative layer must be mounted and correctly hidden from AT (AD-8) —
  // this is what makes the gate genuinely "with the Backdrop active".
  await expect(orbit.backdrop).toBeAttached();
  await expect(orbit.backdrop).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('backdrop-canvas')).toBeAttached();
  // Give the code-split three.js scene a moment to initialize its WebGL context.
  await page.waitForTimeout(1000);
  const webglAvailable = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  // eslint-disable-next-line no-console
  console.log(`[a11y] Backdrop layer mounted; WebGL available in this browser: ${webglAvailable}`);
}

async function runAxe(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');
  // eslint-disable-next-line no-console
  console.log(
    `[a11y] ${label}: ${results.violations.length} total violations ` +
      `(${critical.length} critical, ${serious.length} serious). ` +
      `Rules: ${results.violations.map((v) => `${v.id}[${v.impact}]`).join(', ') || 'none'}`,
  );
  // The AC bar: ZERO critical WCAG 2.1 AA violations (incl. text contrast of
  // Todo content over the Backdrop — color-contrast is part of the AA rule set).
  expect(
    critical,
    `Critical WCAG AA violations:\n${JSON.stringify(critical, null, 2)}`,
  ).toEqual([]);
}

test.describe('Accessibility gate — zero critical WCAG AA, Backdrop active (SM-4)', () => {
  test('loaded state (with a completed item) has zero critical violations', async ({
    orbit,
    page,
    request,
  }) => {
    await seedTodos(request, ['Read the docs', 'Ship the feature', 'Water plants']);
    const seeded = await listTodos(request);
    await setCompleted(request, seeded[0].id, true); // ensure a completed row is present

    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.rows).toHaveCount(3);
    await assertBackdropActive(orbit, page);

    await runAxe(page, 'loaded');
  });

  test('empty state has zero critical violations', async ({ orbit, page }) => {
    // cleanState already emptied the List.
    await page.goto('/');
    await orbit.waitForListReady();
    await expect(orbit.emptyState).toBeVisible();
    await assertBackdropActive(orbit, page);

    await runAxe(page, 'empty');
  });

  test('the core loop is fully keyboard-operable; focus never lands on the backdrop', async ({
    orbit,
    page,
  }) => {
    await page.goto('/');
    await orbit.waitForListReady();

    // Create via keyboard only.
    await orbit.addInput.focus();
    await expect(orbit.addInput).toBeFocused();
    await orbit.addInput.pressSequentially('Keyboard task');
    await orbit.addInput.press('Enter');
    await expect(orbit.row('Keyboard task')).toBeVisible();
    await expect(orbit.addInput).toBeFocused(); // clears + refocuses on success

    // Wait for the create to reconcile (the row gets its real server id, not the
    // temporary optimistic one) so the reconcile refetch can't clobber the toggle
    // below by swapping the row node mid-interaction.
    await expect(orbit.checkbox('Keyboard task')).not.toHaveAttribute(
      'aria-labelledby',
      /optimistic/,
    );

    // Tab reaches the row's checkbox; Space toggles completion.
    await page.keyboard.press('Tab');
    await expect(orbit.checkbox('Keyboard task')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(orbit.checkbox('Keyboard task')).toBeChecked();

    // Next Tab reaches the row's delete affordance; activate it with the
    // keyboard (Enter) to COMPLETE a mutation keyboard-only — proving the loop
    // is fully operable without a pointer (create → toggle → delete all by key).
    await page.keyboard.press('Tab');
    await expect(orbit.deleteButton('Keyboard task')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(orbit.row('Keyboard task')).toHaveCount(0);

    // Tabbing around never focuses the aria-hidden decorative backdrop.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inBackdrop = await page.evaluate(
        () => document.activeElement?.closest('[data-testid="backdrop"]') != null,
      );
      expect(inBackdrop).toBe(false);
    }
  });
});

test.describe('Reduced-motion (FR-8)', () => {
  test('the loop stays fully functional and reduced-motion is signaled (backdrop static)', async ({
    orbit,
    page,
    request,
  }) => {
    // Reduced motion is emulated → the Backdrop renders a single static frame and
    // runs no looping animation (Story 4.2 degradation, unit-verified). Here we
    // confirm the signal is live and the full loop still works.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await orbit.waitForListReady();

    const reduced = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    expect(reduced).toBe(true);
    await expect(orbit.backdrop).toBeAttached();

    // Full create → complete → delete loop under reduced motion.
    await orbit.addTodo('Calm task');
    await expect(orbit.row('Calm task')).toBeVisible();
    await orbit.toggle('Calm task');
    await expect(orbit.checkbox('Calm task')).toBeChecked();
    await orbit.deleteButton('Calm task').click();
    await expect(orbit.row('Calm task')).toHaveCount(0);

    expect(await listTodos(request)).toHaveLength(0);
  });
});
