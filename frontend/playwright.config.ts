import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config. Boots the real backend (:5000) and the Next frontend
 * (:3000) and drives Chromium against them.
 *
 * The frontend is started with BACKEND_URL set so Next proxies /api/* to the
 * backend, and NEXT_PUBLIC_API_URL='/api' so the browser calls the API
 * same-origin — that keeps the HttpOnly auth cookie on :3000 where the Next
 * route-protection middleware can read it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'node src/index.js',
      cwd: '../backend',
      port: 5000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { NODE_ENV: 'development', PORT: '5000' },
    },
    {
      command: 'npx next dev -p 3000',
      port: 3000,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { NODE_ENV: 'development', BACKEND_URL: 'http://localhost:5000', NEXT_PUBLIC_API_URL: '/api' },
    },
  ],
});
