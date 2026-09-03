import { defineConfig, devices } from '@playwright/test';

// See playwright.config.ts: BUNKER_E2E_PORT keeps the suite off a port a dev
// server is already using.
const port = process.env.BUNKER_E2E_PORT ?? '3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm --filter @bunker-studio/web start --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
