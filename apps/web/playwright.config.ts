import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './e2e/load-env';

// Make Supabase env available to global-setup + the spec's cleanup client.
loadEnv();

// Allow pointing the run at an already-running dev server on a custom port
// (e.g. when port 3000 is taken by another project): PW_BASE_URL=http://localhost:3100
const BASE_URL = process.env.PW_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // The demo flow has its own config (playwright.demo.config.ts) so it can
  // also run against a deployed URL. Keep it out of the coaches run.
  testIgnore: ['demo.spec.ts', 'tour/**'],
  globalSetup: './e2e/global-setup',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
