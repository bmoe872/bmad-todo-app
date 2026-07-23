import { expect, test } from '@playwright/test';

// Placeholder smoke spec proving the Playwright runner + config + locally-served
// page all work. Full user-journey E2E (create/complete/delete/clear+undo/empty/
// error) and the @axe-core/playwright accessibility gate land in Epic 6.
test('placeholder page loads and shows the app heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'nearform_todo_app' })).toBeVisible();
});
