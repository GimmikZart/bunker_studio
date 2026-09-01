import { describe, expect, it, vi } from 'vitest';
import { createGitHubApi, GitHubApiError } from './index';

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
            number: 7,
            html_url: 'https://github.com/acme/studio/pull/7',
            head: { ref: 'bunker/task-1-work' },
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
      base: 'main',
      state: 'OPEN',
    });
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
