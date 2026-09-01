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
  await page.getByLabel('Team objective').fill('Ship a safe accessible dashboard');
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
