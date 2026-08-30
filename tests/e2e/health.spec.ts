import { expect, test } from '@playwright/test';

test('web health endpoint is available', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ service: 'web', status: 'ok' });
});
