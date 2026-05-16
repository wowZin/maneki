import { test, expect } from '@playwright/test';

test('admin web app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.*/);
});
