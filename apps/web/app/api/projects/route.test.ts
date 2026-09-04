import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as listProjectCards } from './route';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as connectRepository } from './[projectId]/repository/route';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe('project cards', () => {
  it('reports the repository and delivery state of every project', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 7).toString('base64url'));
    const owner = `cards-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationId = (
      await (
        await createOrganization(
          new Request('http://localhost', {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({ name: 'Card Studio' }),
          }),
        )
      ).json()
    ).organization.id as string;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectId = (
      await (
        await createProject(
          new Request('http://localhost', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Vrsus App', description: 'The public site' }),
          }),
          { params: Promise.resolve({ organizationId }) },
        )
      ).json()
    ).project.id as string;
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).includes('/branches/')
              ? { name: 'main' }
              : { id: 1, default_branch: 'main', permissions: { push: true } },
          ),
          { status: 200 },
        ),
    ) as typeof fetch;
    expect(
      (
        await connectRepository(
          new Request('http://localhost', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              providerType: 'GITHUB',
              owner: 'GimmikZart',
              name: 'vrsus_website',
              defaultBranch: 'main',
              accessToken: 'github_pat_example',
            }),
          }),
          { params: Promise.resolve({ projectId }) },
        )
      ).status,
    ).toBe(201);

    const response = await listProjectCards(
      new Request('http://localhost/api/projects', { headers }),
    );
    expect(response.status).toBe(200);
    const { projects } = await response.json();
    expect(projects).toEqual([
      expect.objectContaining({
        id: projectId,
        name: 'Vrsus App',
        description: 'The public site',
        repository: {
          owner: 'GimmikZart',
          name: 'vrsus_website',
          defaultBranch: 'main',
          status: 'CONNECTED',
        },
        agents: [],
        tasks: { total: 0, active: 0, done: 0, blocked: 0 },
      }),
    ]);
  });

  it('refuses a request without an organization', async () => {
    const response = await listProjectCards(
      new Request('http://localhost/api/projects', {
        headers: { 'x-bunker-user-id': 'someone' },
      }),
    );
    expect(response.status).toBe(401);
  });
});
