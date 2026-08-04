import { test, expect } from '@playwright/test';

test.describe('Public smoke', () => {
  test('login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('unauthenticated dashboard access is redirected away', async ({ page }) => {
    await page.goto('/dashboard');
    // Route-protection middleware bounces unauthenticated users to the landing page.
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
