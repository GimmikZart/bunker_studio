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
