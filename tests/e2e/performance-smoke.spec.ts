import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

const routes = ['/', '/agents', '/studio-labs', '/tasks', '/settings'];
const samplesPerRoute = 5;
const pageServerP95BudgetMs = 800;

test('normal page server response stays within the p95 target', async ({ request }) => {
  const samples: number[] = [];

  for (const route of routes) {
    const warmup = await request.get(route);
    expect(warmup.ok(), `${route} warm-up should succeed`).toBe(true);
    await warmup.dispose();

    for (let index = 0; index < samplesPerRoute; index += 1) {
      const startedAt = performance.now();
      const response = await request.get(route);
      const elapsedMs = performance.now() - startedAt;
      expect(response.ok(), `${route} sample ${index + 1} should succeed`).toBe(true);
      await response.dispose();
      samples.push(elapsedMs);
    }
  }

  const ordered = [...samples].sort((left, right) => left - right);
  const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
  expect(
    p95,
    `normal page server response p95 was ${p95.toFixed(1)}ms across ${samples.length} samples`,
  ).toBeLessThan(pageServerP95BudgetMs);
});
