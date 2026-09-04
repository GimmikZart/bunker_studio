import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as listConnections, POST as connectAccount, DELETE as disconnect } from './route';
import { GET as listRepositories } from './repositories/route';
import { POST as createOrganization } from '../../route';
import { POST as createProject } from '../projects/route';
import { POST as connectRepository } from '../../../projects/[projectId]/repository/route';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

async function studio() {
  const owner = `github-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: 'GitHub Studio' }),
        }),
      )
    ).json()
  ).organization.id as string;
  return {
    headers: { ...baseHeaders, 'x-bunker-organization-id': organizationId },
    organizationId,
  };
}

/** Answers the account, repository listing and access checks GitHub is asked for. */
function githubApi() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/user'))
      return new Response(JSON.stringify({ login: 'GimmikZart', type: 'User' }), { status: 200 });
    if (url.includes('/user/repos'))
      return new Response(
        JSON.stringify([
          {
            name: 'vrsus_website',
            full_name: 'GimmikZart/vrsus_website',
            owner: { login: 'GimmikZart' },
            default_branch: 'main',
            private: true,
            description: 'The site',
            pushed_at: '2026-01-01T00:00:00Z',
            permissions: { push: true },
          },
        ]),
        { status: 200 },
      );
    if (url.includes('/branches/'))
      return new Response(JSON.stringify({ name: 'main' }), { status: 200 });
    return new Response(
      JSON.stringify({ id: 1, default_branch: 'main', permissions: { push: true } }),
      { status: 200 },
    );
  }) as typeof fetch;
}

function connect(headers: Record<string, string>, organizationId: string, token: string) {
  return connectAccount(
    new Request('http://localhost', {
      method: 'POST',
      headers,
      body: JSON.stringify({ accessToken: token }),
    }),
    { params: Promise.resolve({ organizationId }) },
  );
}

describe('organization GitHub account', () => {
  it('connects once and reports the account without echoing the token', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = githubApi();
    const { headers, organizationId } = await studio();

    const response = await connect(headers, organizationId, 'github_pat_example');
    expect(response.status).toBe(201);
    const body = await response.text();
    expect(body).toContain('GimmikZart');
    expect(body).not.toContain('github_pat_example');

    const listed = await listConnections(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ organizationId }),
    });
    const { connections } = await listed.json();
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({ accountLogin: 'GimmikZart', accountType: 'USER' });
  });

  it('reconnecting the same account replaces it instead of adding a second', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = githubApi();
    const { headers, organizationId } = await studio();

    await connect(headers, organizationId, 'github_pat_first');
    await connect(headers, organizationId, 'github_pat_second');

    const listed = await listConnections(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ organizationId }),
    });
    expect((await listed.json()).connections).toHaveLength(1);
  });

  it('says the token was refused rather than blaming the request', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as typeof fetch;
    const { headers, organizationId } = await studio();

    const response = await connect(headers, organizationId, 'github_pat_example');
    expect(response.status).toBe(409);
    const { error } = await response.json();
    expect(error).toContain('did not accept the token');
    expect(error).not.toContain('github_pat_example');
  });

  it('lists the repositories the connected account exposes', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = githubApi();
    const { headers, organizationId } = await studio();
    const connectionId = (
      await (await connect(headers, organizationId, 'github_pat_example')).json()
    ).connection.id as string;

    const response = await listRepositories(
      new Request(`http://localhost?connectionId=${connectionId}`, { headers }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(response.status).toBe(200);
    const { repositories } = await response.json();
    expect(repositories).toEqual([
      expect.objectContaining({
        owner: 'GimmikZart',
        name: 'vrsus_website',
        fullName: 'GimmikZart/vrsus_website',
        defaultBranch: 'main',
        canPush: true,
      }),
    ]);
  });

  it('connects a project repository from the account without asking for a token again', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = githubApi();
    const { headers, organizationId } = await studio();
    const connectionId = (
      await (await connect(headers, organizationId, 'github_pat_example')).json()
    ).connection.id as string;
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
    ).project.id as string;

    const response = await connectRepository(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          providerType: 'GITHUB',
          owner: 'GimmikZart',
          name: 'vrsus_website',
          defaultBranch: 'main',
          githubConnectionId: connectionId,
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(response.status).toBe(201);
    expect((await response.json()).repository.status).toBe('CONNECTED');
  });

  it('removes an account when it is disconnected', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = githubApi();
    const { headers, organizationId } = await studio();
    const connectionId = (
      await (await connect(headers, organizationId, 'github_pat_example')).json()
    ).connection.id as string;

    const response = await disconnect(
      new Request(`http://localhost?connectionId=${connectionId}`, { method: 'DELETE', headers }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(response.status).toBe(204);
    const listed = await listConnections(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ organizationId }),
    });
    expect((await listed.json()).connections).toEqual([]);
  });
});
