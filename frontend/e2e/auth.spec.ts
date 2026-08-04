import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('logs in as admin and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@hrms.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Successful login pushes to /dashboard (which may then route by role).
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@hrms.com');
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page.getByText(/Invalid credentials/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
