import { test, expect } from '@playwright/test';

test('ping endpoint responds', async ({ page }) => {
  await page.goto('/ping');
  await expect(page.locator('body')).toHaveText('PONG');
});
