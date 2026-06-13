import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from '../load-env';

// Standalone config for the narrated product tour. Records video of a single
// long spec at 720p against an already-running dev server. No globalSetup
// (the tour registers its own fresh account) and no webServer (point it at a
// running server via PW_BASE_URL, default :3100).
loadEnv();

const BASE_URL = process.env.PW_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: __dirname,
  testMatch: 'tour.spec.ts',
  timeout: 1_200_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: `${__dirname}/output`,
  preserveOutput: 'always',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 170 },
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
