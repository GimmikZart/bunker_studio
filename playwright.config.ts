import { defineConfig, devices } from '@playwright/test';

// The suite starts its own server, so it cannot share a port with a dev server
// the developer already has running. Override with BUNKER_E2E_PORT to run the
// end-to-end tests without stopping the app.
const port = process.env.BUNKER_E2E_PORT ?? '3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // The functional suite runs against `next dev`, which compiles each route on
  // its first request. A control can therefore stay disabled for several
  // seconds while a request is in flight, and the 5s default is too tight for
  // that. Response times on a built server are enforced separately by the p95
  // smoke in playwright.production.config.ts.
  expect: { timeout: 30_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm --filter @bunker-studio/web dev --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
