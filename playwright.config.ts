import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  webServer: [
    { command: 'npm run dev:server', url: 'http://localhost:3001/api/projects', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev:client', url: 'http://localhost:5173/', reuseExistingServer: true, timeout: 60_000 },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
