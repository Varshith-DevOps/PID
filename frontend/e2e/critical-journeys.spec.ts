import { test, expect } from '@playwright/test';

test.describe('Critical HRMS journeys', () => {
  let adminToken = '';

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@hrms.com', password: 'admin123' },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    adminToken = data.token;
    expect(adminToken).toBeTruthy();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  });

  test('admin can view the employees directory after sign-in', async ({ page }) => {
    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Employee/i })).toBeVisible();
    await expect(page.getByPlaceholder('Search by name or ID...')).toBeVisible();
  });

  test('admin can access the attendance workspace and see the main tabs', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Report' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Corrections/i })).toBeVisible();
  });

  test('admin can access leave management and open the new request view', async ({ page }) => {
    await page.goto('/leave');
    await expect(page.getByRole('heading', { name: 'Leave Management' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Requests' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'New Request' })).toBeVisible();
  });
});
