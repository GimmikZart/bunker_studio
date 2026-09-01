import {
  createGitHubApi,
  ensurePullRequest,
  type GitHubApi,
  type GitHubCiEvidence,
  type GitHubPullRequest,
} from '@bunker-studio/git';
import type { LocalWorkerTask } from './runtime-client.js';

export type CandidatePublication = {
  branch: string;
  candidateCommitSha: string;
};

export type GitHubReviewResult = {
  pullRequest: GitHubPullRequest;
  pullRequestCreated: boolean;
  ci: GitHubCiEvidence;
  publicationStage: 'REVIEW_READY';
};

export class GitHubReviewPreparationError extends Error {
  constructor(readonly result: Record<string, unknown>) {
    super('GitHub review preparation failed.');
    this.name = 'GitHubReviewPreparationError';
  }
}

function reviewMetadata(task: LocalWorkerTask, publication: CandidatePublication) {
  return {
    title: `Bunker Studio task ${task.taskId}`,
    body: [
      'Candidate prepared by the Bunker Studio worker.',
      '',
      `Task ID: ${task.taskId}`,
      `Candidate commit: ${publication.candidateCommitSha}`,
      '',
      'Merge and deployment remain manual and subject to the configured review gates.',
    ].join('\n'),
  };
}

export async function prepareGitHubReview(input: {
  task: LocalWorkerTask;
  publication: CandidatePublication;
  api?: GitHubApi;
}): Promise<GitHubReviewResult> {
  const repository = input.task.repository;
  if (
    !repository ||
    repository.providerType !== 'GITHUB' ||
    repository.status !== 'CONNECTED' ||
    !repository.credential
  )
    throw new GitHubReviewPreparationError({ publicationStage: 'BRANCH_PUSHED' });
  const api = input.api ?? createGitHubApi({ token: repository.credential });
  const metadata = reviewMetadata(input.task, input.publication);
  let ensured: Awaited<ReturnType<typeof ensurePullRequest>>;
  try {
    ensured = await ensurePullRequest(api, {
      repository: { owner: repository.owner, name: repository.name },
      head: input.publication.branch,
      expectedHeadSha: input.publication.candidateCommitSha,
      base: repository.defaultBranch,
      ...metadata,
    });
  } catch {
    throw new GitHubReviewPreparationError({ publicationStage: 'BRANCH_PUSHED' });
  }
  try {
    const ci = await api.getCiEvidence(
      { owner: repository.owner, name: repository.name },
      input.publication.candidateCommitSha,
    );
    if (ci.commitSha !== input.publication.candidateCommitSha)
      throw new Error('GitHub CI evidence does not match the candidate commit.');
    return {
      pullRequest: ensured.pullRequest,
      pullRequestCreated: ensured.created,
      ci,
      publicationStage: 'REVIEW_READY',
    };
  } catch {
    throw new GitHubReviewPreparationError({
      pullRequest: ensured.pullRequest,
      pullRequestCreated: ensured.created,
      publicationStage: 'PULL_REQUEST_READY',
    });
  }
}
