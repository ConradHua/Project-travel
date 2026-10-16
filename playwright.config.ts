import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const apiPort = process.env.API_PORT ?? '3002';
const clientPort = process.env.CLIENT_PORT ?? '5174';
process.env.API_PORT = apiPort;
process.env.CLIENT_PORT = clientPort;
const dataDir = mkdtempSync(join(tmpdir(), 'gongdi-playwright-'));

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: 1,
  webServer: [
    { command: 'npm run dev:server', env: { PORT: apiPort, DATA_DIR: dataDir }, url: `http://localhost:${apiPort}/api/projects`, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npm run dev:client', env: { API_PORT: apiPort, CLIENT_PORT: clientPort }, url: `http://localhost:${clientPort}/`, reuseExistingServer: false, timeout: 60_000 },
  ],
  use: {
    baseURL: `http://localhost:${clientPort}`,
    trace: 'on-first-retry',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
