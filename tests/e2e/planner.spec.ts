import { test, expect } from '@playwright/test';

test('planner page loads', async ({ page }) => {
  await page.goto('http://localhost:3000/workpacks/planner');
  await expect(page.locator('body')).toBeVisible();
});
