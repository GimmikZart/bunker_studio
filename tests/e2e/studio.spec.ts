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
