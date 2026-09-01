import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getWebOperationalRepository: vi.fn(),
  createWorkerServiceSupabaseClient: vi.fn(),
  createGitHubApi: vi.fn(),
  decryptSecret: vi.fn(() => 'decrypted-token'),
}));

vi.mock('../../../_data', () => ({
  getWebOperationalRepository: mocks.getWebOperationalRepository,
}));
vi.mock('../../../_supabase', () => ({
  createWorkerServiceSupabaseClient: mocks.createWorkerServiceSupabaseClient,
}));
vi.mock('@bunker-studio/db', () => ({ decryptSecret: mocks.decryptSecret }));
vi.mock('@bunker-studio/git', async (importOriginal) => {
  const original = await importOriginal<typeof import('@bunker-studio/git')>();
  return { ...original, createGitHubApi: mocks.createGitHubApi };
});

import { POST } from './route';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function serviceClient() {
  const writes: { table: string; value: unknown }[] = [];
  return {
    writes,
    client: {
      from: (table: string) => {
        const query = {
          select: () => query,
          update: (value: unknown) => {
            writes.push({ table, value });
            return query;
          },
          upsert: (value: unknown) => {
            writes.push({ table, value });
            return query;
          },
          eq: () => query,
          maybeSingle: async () => ({
            data: {
              provider_type: 'GITHUB',
              repo_owner: 'acme',
              repo_name: 'studio',
              default_branch: 'main',
              status: 'CONNECTED',
              encrypted_auth_blob: { version: 1 },
            },
            error: null,
          }),
          then: (resolve: (value: { error: null }) => unknown) =>
            Promise.resolve({ error: null }).then(resolve),
        };
        return query;
      },
    },
  };
}

describe('task GitHub CI refresh route', () => {
  it('refreshes the exact candidate SHA and upserts bounded evidence', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', 'test-master-key');
    mocks.getWebOperationalRepository.mockResolvedValue({
      getRole: async () => 'OWNER',
      listTasks: async () => [
        {
          id: '22222222-2222-4222-8222-222222222222',
          projectId: '33333333-3333-4333-8333-333333333333',
          candidateBranch: 'bunker/task',
          candidateCommitSha: 'candidate-sha',
        },
      ],
    });
    const service = serviceClient();
    mocks.createWorkerServiceSupabaseClient.mockReturnValue(service.client);
    mocks.createGitHubApi.mockImplementation(({ token }: { token: string }) => {
      expect(token).toBe('decrypted-token');
      return {
        getCiEvidence: async () => ({
          commitSha: 'candidate-sha',
          status: 'PASS',
          checks: [
            {
              name: 'tests',
              source: 'CHECK_RUN',
              status: 'COMPLETED',
              conclusion: 'success',
            },
          ],
        }),
      };
    });
    const response = await POST(
      new Request('http://localhost/api/tasks/task/github', {
        method: 'POST',
        headers: {
          'x-bunker-user-id': 'owner',
          'x-bunker-organization-id': '11111111-1111-4111-8111-111111111111',
        },
      }),
      { params: Promise.resolve({ taskId: '22222222-2222-4222-8222-222222222222' }) },
    );
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ ci: { commitSha: 'candidate-sha', status: 'PASS' } });
    expect(service.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'tasks',
          value: expect.objectContaining({ candidate_ci_status: 'PASS' }),
        }),
        expect.objectContaining({ table: 'verification_runs' }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain('decrypted-token');
  });

  it('does not call GitHub without a tenant-scoped published candidate', async () => {
    mocks.getWebOperationalRepository.mockResolvedValue({
      getRole: async () => 'OWNER',
      listTasks: async () => [],
    });
    mocks.createWorkerServiceSupabaseClient.mockReturnValue(serviceClient().client);
    const response = await POST(
      new Request('http://localhost/api/tasks/task/github', {
        method: 'POST',
        headers: {
          'x-bunker-user-id': 'owner',
          'x-bunker-organization-id': '11111111-1111-4111-8111-111111111111',
        },
      }),
      { params: Promise.resolve({ taskId: '22222222-2222-4222-8222-222222222222' }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.createGitHubApi).not.toHaveBeenCalled();
  });
});
