import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as connectRepository } from './route';

async function studio() {
  const owner = `repo-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: 'Repo Studio' }),
        }),
      )
    ).json()
  ).organization.id;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const projectId = (
    await (
      await createProject(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'Vrsus App' }),
        }),
        { params: Promise.resolve({ organizationId }) },
      )
    ).json()
  ).project.id;
  return { headers, projectId };
}

function connect(headers: Record<string, string>, projectId: string, accessToken?: string) {
  return connectRepository(
    new Request('http://localhost', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        providerType: 'GITHUB',
        owner: 'GimmikZart',
        name: 'vrsus_website',
        defaultBranch: 'main',
        ...(accessToken ? { accessToken } : {}),
      }),
    }),
    { params: Promise.resolve({ projectId }) },
  );
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe('repository connection failures', () => {
  it('says the token was refused rather than blaming the request', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 3).toString('base64url'));
    const { headers, projectId } = await studio();
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as typeof fetch;

    const response = await connect(headers, projectId, 'github_pat_example');
    expect(response.status).toBe(409);
    const { error } = await response.json();
    expect(error).toContain('did not accept the token');
    // The secret must never come back in the message.
    expect(error).not.toContain('github_pat_example');
  });

  it('names the repository and branch when GitHub cannot see them', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 3).toString('base64url'));
    const { headers, projectId } = await studio();
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 404 })) as typeof fetch;

    const response = await connect(headers, projectId, 'github_pat_example');
    expect(response.status).toBe(409);
    const { error } = await response.json();
    expect(error).toContain('GimmikZart/vrsus_website');
    expect(error).toContain('main');
    expect(error).toContain('Repository access');
  });

  it('explains a permission refusal instead of reporting a bad request', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 3).toString('base64url'));
    const { headers, projectId } = await studio();
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as typeof fetch;

    const response = await connect(headers, projectId, 'github_pat_example');
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('Contents read/write');
  });

  it('still reports a malformed body as a bad request', async () => {
    const { headers, projectId } = await studio();
    const response = await connectRepository(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ providerType: 'GITHUB' }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(response.status).toBe(400);
  });

  it('connects when GitHub accepts the token and reports push access', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 3).toString('base64url'));
    const { headers, projectId } = await studio();
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

    const response = await connect(headers, projectId, 'github_pat_example');
    expect(response.status).toBe(201);
    const { repository } = await response.json();
    expect(repository.status).toBe('CONNECTED');
    expect(JSON.stringify(repository)).not.toContain('github_pat_example');
  });
});
