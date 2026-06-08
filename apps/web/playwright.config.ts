import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './e2e/load-env';

// Make Supabase env available to global-setup + the spec's cleanup client.
loadEnv();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
