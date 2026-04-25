import { test, expect } from '@playwright/test';

test('hangar page loads', async ({ page }) => {
  await page.goto('/workpacks/hangar');
  await expect(page.locator('body')).toBeVisible();
});
