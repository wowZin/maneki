import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60 * 1000, // 60s per test
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'web-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
      testMatch: /web\/.*\.spec\.ts/,
    },
    {
      name: 'web-admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
      testMatch: /web-admin\/.*\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @maneki/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter @maneki/admin-web dev',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
