import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

test('onboarding creates a local development organization', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByLabel('Organization name').fill(`E2E Studio ${Date.now()}`);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByText('Organization created. Your studio is ready.')).toBeVisible({
    timeout: 60_000,
  });
});

test('team builder proposes editable hires without immediately creating agents', async ({
  page,
}) => {
  await page.goto('/onboarding');
  await page.getByLabel('Organization name').fill(`E2E Team ${Date.now()}`);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByText('Organization created. Your studio is ready.')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto('/teams');
  await page
    .getByRole('textbox', { name: 'Team objective' })
    .fill('Ship a safe accessible dashboard');
  const proposal = page.waitForResponse(
    (response) =>
      response.url().includes('/api/staffing/proposals') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Propose team' }).click();
  expect((await proposal).status()).toBe(200);
  await expect(page.getByText('Review and edit every proposed hire')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Lead Architect / Orchestrator').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and hire team' })).toBeVisible();
});

test('structured memory is saved and retrieved without using the conversation archive', async ({
  page,
}) => {
  await page.goto('/onboarding');
  await page.getByLabel('Organization name').fill(`E2E Memory ${Date.now()}`);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByText('Organization created. Your studio is ready.')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto('/conversations');
  await expect(page.getByLabel('Organization', { exact: true }).last()).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Memory' })
    .fill('Use durable queue retries for provider quota recovery');
  await expect(page.getByRole('button', { name: 'Save memory' })).toBeEnabled();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/memories') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save memory' }).click();
  expect((await saved).status()).toBe(201);
  await page.getByLabel('Search memories').fill('durable queue');
  const memoryPanel = page.getByLabel('Structured memory');
  await expect(memoryPanel.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
  await memoryPanel.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('Use durable queue retries for provider quota recovery')).toBeVisible(
    {
      timeout: 30_000,
    },
  );
});

test('cost center and in-app notification inbox are available for an organization', async ({
  page,
}) => {
  await page.goto('/onboarding');
  await page.getByLabel('Organization name').fill(`E2E Cost ${Date.now()}`);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByText('Organization created. Your studio is ready.')).toBeVisible({
    timeout: 60_000,
  });
  await page.goto('/costs');
  await expect(page.getByLabel('Cost center')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Month forecast')).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByLabel('Notifications')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('settings monitors and revokes a local worker', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByLabel('Organization name').fill(`E2E Worker ${Date.now()}`);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByText('Organization created. Your studio is ready.')).toBeVisible({
    timeout: 60_000,
  });
  const organizationId = await page.evaluate(() =>
    window.localStorage.getItem('bunker-organization-id'),
  );
  expect(organizationId).toBeTruthy();
  const registration = await page.evaluate(async (id) => {
    const response = await fetch('/api/workers/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bunker-organization-id': id!,
        'x-bunker-user-id': 'local-owner',
      },
      body: JSON.stringify({
        name: 'E2E PC',
        capabilities: ['openai-compatible'],
        allowedScopes: ['apps/web'],
        maxConcurrent: 1,
      }),
    });
    return { status: response.status, body: await response.json() };
  }, organizationId);
  expect(registration.status).toBe(201);
  await page.goto('/settings');
  await expect(page.getByText('E2E PC')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Download organization export' })).toBeVisible();
  await expect(page.getByLabel('Import Bunker Studio export')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('E2E PC was revoked.')).toBeVisible({ timeout: 60_000 });
});

test('login and signup flows expose accessible credential forms', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

test('PWA manifest and service worker are served', async ({ request }) => {
  expect((await request.get('/manifest.webmanifest')).ok()).toBe(true);
  expect((await request.get('/sw.js')).ok()).toBe(true);
});
