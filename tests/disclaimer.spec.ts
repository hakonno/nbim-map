import { test, expect } from '@playwright/test';

/**
 * The disclaimer is dismissed by storing a hash of its content, so it
 * re-appears automatically when the copy changes in code. These tests lock in
 * the user-facing behaviour: it shows on first visit and stays dismissed across
 * reloads while the content (hash) is unchanged.
 */
test.describe('disclaimer modal', () => {
  test('shows on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  });

  test('stays dismissed after acknowledging and reloading', async ({ page }) => {
    await page.goto('/');
    const gotIt = page.getByRole('button', { name: 'Got it' });
    await gotIt.click();
    await expect(gotIt).toBeHidden();

    // Same content => same stored hash => modal does not reappear.
    await page.reload();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await expect(gotIt).toBeHidden();
  });
});
