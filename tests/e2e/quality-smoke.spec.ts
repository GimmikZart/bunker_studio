import { expect, test } from '@playwright/test';

test.setTimeout(180_000);

const coreRoutes = ['/', '/agents', '/studio-labs', '/tasks', '/settings'];
const viewports = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
];

test('core pages render with named controls at desktop and mobile widths', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of coreRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route} should render successfully`).toBe(true);
      await expect(page.locator('main')).toBeVisible();

      const audit = await page.locator('input, button, a').evaluateAll((elements) =>
        elements
          .filter((element) => !element.closest('[aria-hidden="true"]'))
          .map((element) => {
            const label = element.getAttribute('aria-label');
            const labelledByIds = element.getAttribute('aria-labelledby');
            const text = element.textContent?.trim();
            const id = element.getAttribute('id');
            const labelledBy = labelledByIds
              ?.split(/\s+/)
              .map((labelId) => document.getElementById(labelId)?.textContent?.trim())
              .filter(Boolean)
              .join(' ');
            const associatedLabel = id
              ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()
              : undefined;
            return {
              tag: element.tagName,
              id,
              name: label || labelledBy || text || associatedLabel,
            };
          })
          .filter((element) => !element.name),
      );
      expect(audit, `${route} has unnamed interactive controls`).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${route} overflows at ${viewport.width}px`).toBe(false);
    }
  }

  expect(pageErrors).toEqual([]);
});
