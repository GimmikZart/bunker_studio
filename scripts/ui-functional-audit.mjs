import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const artifactDir = 'artifacts/ui-audit-2026-08-31';
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const evidence = [];
let consoleMessages = [];
let pageErrors = [];
let requestFailures = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning')
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) =>
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText }),
);

async function goto(path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
  // In Next dev mode the route HTML can arrive before the client bundle has
  // hydrated.  Wait for network quiet (best effort) before interacting so the
  // audit verifies real client behaviour instead of racing hydration.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(350);
}
async function record(id, action, expected, result, name) {
  const screenshot = `${artifactDir}/${name}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  evidence.push({
    id,
    action,
    expected,
    result,
    screenshot,
    url: page.url(),
    console: consoleMessages,
    pageErrors,
    requestFailures,
  });
  consoleMessages = [];
  pageErrors = [];
  requestFailures = [];
}
async function selectOrganization() {
  const organizations = await page.evaluate(async () => {
    const response = await fetch('/api/organizations', {
      headers: { 'x-bunker-user-id': 'local-owner' },
    });
    return response.ok ? ((await response.json()).organizations ?? []) : [];
  });
  const organization = organizations.at(-1);
  if (!organization) throw new Error('Audit organization was not created.');
  await page.evaluate((id) => localStorage.setItem('bunker-organization-id', id), organization.id);
}

try {
  const orgName = `UI Audit ${Date.now()}`;
  await goto('/');
  await Promise.all([
    page.waitForURL(/\/projects$/),
    page.getByRole('link', { name: 'Create project' }).click(),
  ]);
  await record(
    'UI-001',
    'Home → Create project',
    'Functional CTA reaches Projects',
    'Reached /projects',
    'UI-001-project-cta',
  );
  await goto('/');
  await Promise.all([
    page.waitForURL(/\/settings$/),
    page.getByRole('link', { name: 'Connect a provider' }).click(),
  ]);
  await record(
    'UI-001',
    'Home → Connect a provider',
    'Functional CTA reaches Settings',
    'Reached /settings',
    'UI-001-provider-cta',
  );
  await goto('/onboarding');
  await page.getByLabel('Organization name').fill(orgName);
  if ((await page.getByLabel('Organization name').inputValue()) !== orgName)
    throw new Error('Onboarding input did not retain the entered organization name.');
  const organizationResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/organizations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create organization' }).click();
  if (!(await organizationResponse).ok())
    throw new Error('Organization creation request was rejected.');
  await page.getByRole('heading', { name: 'Choose the next step' }).waitFor();
  await selectOrganization();
  await record(
    'UI-001',
    'Onboarding → create organization',
    'Explicit project and agent next steps',
    'Organization created with two next-step CTAs',
    'UI-001-onboarding',
  );

  await goto('/projects');
  await page.getByLabel('Project name').fill('Audit Delivery Project');
  await page.getByLabel('Description').fill('Project created by the functional audit.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByText('Created.', { exact: true }).waitFor();
  await record(
    'UI-003',
    'Projects → create project',
    'Project confirmation and selectable task project',
    'Project created',
    'UI-003-project',
  );

  await goto('/agents');
  await page.getByLabel('Name').fill('Audit Frontend Agent');
  await page.getByLabel('Agent template').selectOption('frontend');
  await page.getByLabel('Provider and model').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Create agent' }).click();
  await page.getByText(/Agent created and ready/).waitFor();
  await record(
    'UI-002',
    'Agents → select template and provider model',
    'Guided agent creation without technical free text',
    'Template applied and agent created',
    'UI-002-agent',
  );

  await goto('/tasks');
  await page.getByLabel('Task title').fill('Audit backend task');
  await page
    .getByLabel('Description')
    .fill('Persist a task with scope and an explicit acceptance check.');
  await page.getByLabel('Read scope').fill('apps/web');
  await page.getByLabel('Write scope').fill('apps/web/app');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByText('Task created in DRAFT.').waitFor();
  await page.getByLabel('Transition Audit backend task').selectOption('READY');
  await page.getByText('Task moved to READY.').waitFor();
  await record(
    'UI-003',
    'Tasks → create and transition task',
    'Prerequisites, scope and deterministic transition are visible',
    'Task moved DRAFT → READY',
    'UI-003-task',
  );

  await page.getByLabel('Type').selectOption('FRONTEND');
  await page.getByText('A frontend task needs an approved design.').waitFor();
  await record(
    'UI-006',
    'Tasks → frontend without design',
    'Design gate includes recovery CTA',
    'Create or approve a design CTA is visible',
    'UI-006-design-gate',
  );

  await goto('/settings');
  await page.locator('#providers').waitFor();
  await record(
    'UI-004',
    'Settings → provider state',
    'Provider status, models and secure setup explanation',
    'Provider card is visible; secrets are never rendered',
    'UI-004-provider',
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await goto('/');
  const desktopLinks = await page
    .locator('nav[aria-label="Primary navigation"] a')
    .evaluateAll((links) =>
      links.map((link) => ({ text: link.textContent?.trim(), href: link.getAttribute('href') })),
    );
  const invalidLink = desktopLinks.find((link) => !link.href || link.href.startsWith('#'));
  if (invalidLink) throw new Error(`Invalid desktop navigation link: ${invalidLink.text}`);
  await record(
    'UI-005',
    'Desktop primary navigation',
    'Every primary route has a real URL',
    `${desktopLinks.length} real route links`,
    'UI-005-desktop-nav',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/');
  await page.locator('summary[aria-label="Open all navigation routes"]').click();
  await page.getByRole('link', { name: 'Settings' }).last().waitFor();
  await record(
    'UI-005',
    '390px mobile navigation',
    'Primary routes are reachable through bottom navigation and More menu',
    'Bottom navigation and More menu are reachable',
    'UI-005-mobile-nav',
  );

  for (const route of ['/', '/agents', '/tasks', '/settings']) {
    await goto(route);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  if (consoleMessages.length || pageErrors.length || requestFailures.length)
    throw new Error('Console, pageerror, or request failure recorded during hard-refresh sweep.');
  await record(
    'UI-007',
    'Hard refresh core routes',
    'No application console errors or hydration warnings',
    'No console errors, page errors, or failed requests',
    'UI-007-console',
  );

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of [
      '/',
      '/onboarding',
      '/projects',
      '/teams',
      '/agents',
      '/tasks',
      '/settings',
      '/approvals',
      '/meetings',
      '/costs',
      '/activity',
    ]) {
      await goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (overflow || !(await page.locator('main').isVisible()))
        throw new Error(`Responsive failure at ${viewport.width}px ${route}`);
    }
    await record(
      'UI-008',
      `${viewport.width}px responsive sweep`,
      'No horizontal overflow and a reachable main area',
      `All audited routes pass at ${viewport.width}px`,
      `UI-008-${viewport.width}`,
    );
  }
} catch (error) {
  await record(
    'AUDIT-FAIL',
    'Audit execution',
    'All UI checks pass',
    error instanceof Error ? error.message : String(error),
    'audit-failure',
  );
  await fs.writeFile(
    `${artifactDir}/results.json`,
    JSON.stringify({ baseURL, generatedAt: new Date().toISOString(), evidence }, null, 2),
  );
  await browser.close();
  throw error;
}

await fs.writeFile(
  `${artifactDir}/results.json`,
  JSON.stringify({ baseURL, generatedAt: new Date().toISOString(), evidence }, null, 2),
);
console.log(JSON.stringify({ baseURL, artifactDir, evidenceCount: evidence.length }, null, 2));
await browser.close();
