import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './e2e/load-env';

// Demo-flow config. Targets localhost by default (spins up next dev), or a
// deployed URL when E2E_BASE_URL is set (no local server) — for post-deploy
// smoke tests against production.
loadEnv();

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const isRemote = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo.spec.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: isRemote ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }),
});
