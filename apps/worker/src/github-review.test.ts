import { describe, expect, it, vi } from 'vitest';
import type { GitHubApi } from '@bunker-studio/git';
import {
  GitHubReviewPreparationError,
  prepareGitHubReview,
  type CandidatePublication,
} from './github-review';
import type { LocalWorkerTask } from './runtime-client';

const publication: CandidatePublication = {
  branch: 'bunker/22222222-2222-4222-8222-222222222222',
  candidateCommitSha: 'candidate-sha',
};

const task = {
  taskId: '22222222-2222-4222-8222-222222222222',
  title: 'Do not expose this user-controlled title',
  description: 'provider-secret must not appear in the pull request',
  provider: { apiKey: 'provider-secret' },
  repository: {
    providerType: 'GITHUB',
    owner: 'acme',
    name: 'studio',
    defaultBranch: 'main',
    status: 'CONNECTED',
    credential: 'github-secret',
  },
} as LocalWorkerTask;

function api(overrides: Partial<GitHubApi> = {}): GitHubApi {
  return {
    findPullRequest: vi.fn(async () => null),
    createPullRequest: vi.fn(async (input) => {
      expect(JSON.stringify(input)).not.toContain('provider-secret');
      expect(JSON.stringify(input)).not.toContain('github-secret');
      expect(input.title).toBe(`Bunker Studio task ${task.taskId}`);
      return {
        number: 7,
        url: 'https://github.com/acme/studio/pull/7',
        head: publication.branch,
        headSha: publication.candidateCommitSha,
        base: 'main',
        state: 'OPEN',
      };
    }),
    updatePullRequest: vi.fn(),
    getCiEvidence: vi.fn(async () => ({
      commitSha: publication.candidateCommitSha,
      status: 'PENDING',
      checks: [],
    })),
    ...overrides,
  } as unknown as GitHubApi;
}

describe('GitHub review preparation', () => {
  it('creates one bounded PR and records CI for the exact candidate SHA', async () => {
    await expect(prepareGitHubReview({ task, publication, api: api() })).resolves.toMatchObject({
      pullRequest: { number: 7, headSha: publication.candidateCommitSha },
      pullRequestCreated: true,
      ci: { commitSha: publication.candidateCommitSha, status: 'PENDING' },
      publicationStage: 'REVIEW_READY',
    });
  });

  it('preserves the completed publication stage when PR or CI APIs fail', async () => {
    await expect(
      prepareGitHubReview({
        task,
        publication,
        api: api({ findPullRequest: vi.fn(async () => Promise.reject(new Error('offline'))) }),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GitHubReviewPreparationError>>({
        result: { publicationStage: 'BRANCH_PUSHED' },
      }),
    );

    await expect(
      prepareGitHubReview({
        task,
        publication,
        api: api({ getCiEvidence: vi.fn(async () => Promise.reject(new Error('offline'))) }),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GitHubReviewPreparationError>>({
        result: expect.objectContaining({ publicationStage: 'PULL_REQUEST_READY' }),
      }),
    );
  });
});
