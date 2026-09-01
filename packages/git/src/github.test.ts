import { describe, expect, it, vi } from 'vitest';
import {
  createGitHubApi,
  ensurePullRequest,
  githubCiVerificationRuns,
  GitHubApiError,
  type GitHubApi,
} from './index';

describe('GitHub API adapter', () => {
  it('verifies repository, branch, and push permission before saving a credential', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 42, default_branch: 'main', permissions: { push: true } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'main' }), { status: 200 }));
    await expect(
      createGitHubApi({ token: 'token', fetchImpl }).verifyRepositoryAccess(
        { owner: 'acme', name: 'studio' },
        'main',
      ),
    ).resolves.toEqual({ repositoryId: '42', defaultBranch: 'main', canPush: true });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      new URL('https://api.github.com/repos/acme/studio/branches/main'),
      expect.anything(),
    );
  });

  it('creates branches without leaking credentials into requests or errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer secret-token' });
      return new Response(JSON.stringify({ ref: 'refs/heads/bunker/task-1-work' }), {
        status: 201,
      });
    });
    await createGitHubApi({ token: 'secret-token', fetchImpl }).createBranch(
      { owner: 'acme', name: 'studio' },
      'bunker/task-1-work',
      'base-sha',
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://api.github.com/repos/acme/studio/git/refs'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('normalizes check-run status and creates a reviewable pull request', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'candidate-sha',
            check_runs: [
              {
                name: 'verify',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://check',
              },
              { name: 'security', status: 'queued', conclusion: null },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'candidate-sha',
            statuses: [{ context: 'legacy-ci', state: 'success', target_url: 'https://status' }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 7,
            html_url: 'https://github.com/acme/studio/pull/7',
            head: { ref: 'bunker/task-1-work', sha: 'candidate-sha' },
            base: { ref: 'main' },
            state: 'open',
          }),
          { status: 201 },
        ),
      );
    const api = createGitHubApi({ token: 'token', fetchImpl });
    await expect(
      api.getCiEvidence({ owner: 'acme', name: 'studio' }, 'candidate-sha'),
    ).resolves.toMatchObject({
      commitSha: 'candidate-sha',
      status: 'PENDING',
    });
    await expect(
      api.createPullRequest({
        repository: { owner: 'acme', name: 'studio' },
        head: 'bunker/task-1-work',
        base: 'main',
        title: 'Bunker candidate',
      }),
    ).resolves.toEqual({
      number: 7,
      url: 'https://github.com/acme/studio/pull/7',
      head: 'bunker/task-1-work',
      headSha: 'candidate-sha',
      base: 'main',
      state: 'OPEN',
    });
  });

  it('reuses and updates the exact existing pull request across retries', async () => {
    const existing = {
      number: 7,
      url: 'https://github.com/acme/studio/pull/7',
      head: 'bunker/task-1-work',
      headSha: 'candidate-sha',
      base: 'main',
      state: 'OPEN' as const,
    };
    const api = {
      findPullRequest: vi.fn(async () => existing),
      updatePullRequest: vi.fn(async () => existing),
      createPullRequest: vi.fn(),
    } as unknown as GitHubApi;
    await expect(
      ensurePullRequest(api, {
        repository: { owner: 'acme', name: 'studio' },
        head: existing.head,
        expectedHeadSha: existing.headSha,
        base: existing.base,
        title: 'Bunker task',
        body: 'Bounded body',
      }),
    ).resolves.toEqual({ pullRequest: existing, created: false });
    expect(api.updatePullRequest).toHaveBeenCalledTimes(1);
    expect(api.createPullRequest).not.toHaveBeenCalled();
  });

  it('looks up by owner/head/base and reopens the same PR through the HTTP adapter', async () => {
    const response = {
      number: 7,
      html_url: 'https://github.com/acme/studio/pull/7',
      head: { ref: 'bunker/task', sha: 'candidate-sha' },
      base: { ref: 'main' },
      state: 'open',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...response, state: 'closed' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify(response)));
    const api = createGitHubApi({ token: 'token', fetchImpl });
    await expect(
      ensurePullRequest(api, {
        repository: { owner: 'acme', name: 'studio' },
        head: 'bunker/task',
        expectedHeadSha: 'candidate-sha',
        base: 'main',
        title: 'Bunker task',
      }),
    ).resolves.toMatchObject({ created: false, pullRequest: { number: 7, state: 'OPEN' } });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'state=all&head=acme%3Abunker%2Ftask&base=main',
    );
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({ state: 'open' });
  });

  it('treats absent checks as pending and definite failures as failed', async () => {
    const emptyFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sha: 'sha', check_runs: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sha: 'sha', statuses: [] }), { status: 200 }),
      );
    await expect(
      createGitHubApi({ token: 'token', fetchImpl: emptyFetch }).getCiEvidence(
        { owner: 'acme', name: 'studio' },
        'sha',
      ),
    ).resolves.toMatchObject({ status: 'PENDING', checks: [] });

    const failingFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'sha',
            check_runs: [
              { name: 'security', status: 'completed', conclusion: 'failure' },
              { name: 'tests', status: 'queued', conclusion: null },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sha: 'sha', statuses: [] }), { status: 200 }),
      );
    await expect(
      createGitHubApi({ token: 'token', fetchImpl: failingFetch }).getCiEvidence(
        { owner: 'acme', name: 'studio' },
        'sha',
      ),
    ).resolves.toMatchObject({ status: 'FAIL' });
  });

  it('creates bounded idempotent verification records without copying remote output', () => {
    const runs = githubCiVerificationRuns({
      commitSha: 'sha',
      status: 'PENDING',
      checks: [
        {
          name: 'tests',
          source: 'CHECK_RUN',
          status: 'IN_PROGRESS',
          conclusion: null,
          url: 'https://github.example/checks/secret-output-is-not-fetched',
        },
      ],
    });
    expect(runs[0]).toMatchObject({ status: 'PENDING', commandOrCheck: 'GitHub CI: tests' });
    expect(JSON.stringify(runs)).not.toContain('secret-output');
    expect(
      githubCiVerificationRuns({ commitSha: 'sha', status: 'PENDING', checks: [] })[0],
    ).toMatchObject({ externalKey: 'github:sha:discovery', status: 'PENDING' });
    expect(
      githubCiVerificationRuns({
        commitSha: 'sha',
        status: 'PENDING',
        checks: Array.from({ length: 201 }, (_, index) => ({
          name: `check-${index}`,
          source: 'CHECK_RUN' as const,
          status: 'IN_PROGRESS' as const,
          conclusion: null,
        })),
      }),
    ).toHaveLength(200);
  });

  it('uses a sanitized error for failed API requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    await expect(
      createGitHubApi({ token: 'secret-token', fetchImpl }).getCiEvidence(
        { owner: 'acme', name: 'studio' },
        'main',
      ),
    ).rejects.toEqual(new GitHubApiError('GitHub API request failed with status 401.', 401));
  });
});
