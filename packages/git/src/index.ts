export const PACKAGE_NAME = '@bunker-studio/git';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type WorkspaceRequest = {
  projectSlug: string;
  taskId: string;
  baseCommitSha: string;
  readScope: string[];
  writeScope: string[];
};

export function branchName(input: Pick<WorkspaceRequest, 'projectSlug' | 'taskId'>): string {
  return `bunker/${input.projectSlug}/${input.taskId}-work`;
}

export function validateWorkspaceIsolation(tasks: WorkspaceRequest[]): void {
  for (let index = 0; index < tasks.length; index += 1) {
    for (const other of tasks.slice(index + 1)) {
      if (
        tasks[index]?.writeScope.some((scope) =>
          other.writeScope.some(
            (candidate) =>
              scope === candidate ||
              scope.startsWith(`${candidate}/`) ||
              candidate.startsWith(`${scope}/`),
          ),
        )
      ) {
        throw new Error(
          `Overlapping write scopes require serialization: ${tasks[index]?.taskId} and ${other.taskId}`,
        );
      }
    }
  }
}

export function workspacePath(runId: string): string {
  return `/workspaces/${runId}`;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  const received = Buffer.from(signature);
  const target = Buffer.from(expected);
  return received.length === target.length && timingSafeEqual(received, target);
}

export type RepositoryConnection = {
  id: string;
  providerType: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  owner: string;
  name: string;
  defaultBranch: string;
  status: 'CONNECTED' | 'REQUIRES_AUTH';
};

export type WorkspaceArtifact = {
  taskId: string;
  branch: string;
  workspace: string;
  baseCommitSha: string;
  candidateCommitSha?: string;
  diff?: string;
};

export type GitProvider = {
  createBranch: (
    repository: RepositoryConnection,
    branch: string,
    baseCommitSha: string,
  ) => Promise<void>;
  collectDiff: (workspace: string) => Promise<{ candidateCommitSha: string; diff: string }>;
};

export type GitHubRepositoryRef = Pick<RepositoryConnection, 'owner' | 'name'>;

export type GitHubCheck = {
  name: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED';
  conclusion: string | null;
  url?: string;
};

export type GitHubCiEvidence = {
  commitSha: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  checks: GitHubCheck[];
};

export type GitHubPullRequest = {
  number: number;
  url: string;
  head: string;
  base: string;
  state: 'OPEN' | 'CLOSED';
};

export type GitHubApi = {
  createBranch: (
    repository: GitHubRepositoryRef,
    branch: string,
    baseCommitSha: string,
  ) => Promise<void>;
  getCiEvidence: (repository: GitHubRepositoryRef, ref: string) => Promise<GitHubCiEvidence>;
  createPullRequest: (input: {
    repository: GitHubRepositoryRef;
    head: string;
    base: string;
    title: string;
    body?: string;
  }) => Promise<GitHubPullRequest>;
};

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

function githubPath(repository: GitHubRepositoryRef, suffix: string): string {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}${suffix}`;
}

function ciStatus(checks: GitHubCheck[]): GitHubCiEvidence['status'] {
  if (checks.some((check) => check.status !== 'COMPLETED')) return 'PENDING';
  if (
    checks.some(
      (check) =>
        !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((check.conclusion ?? '').toUpperCase()),
    )
  )
    return 'FAIL';
  return 'PASS';
}

/**
 * GitHub is deliberately kept behind this narrow adapter. The core never
 * receives a token and the adapter never includes credentials in errors.
 */
export function createGitHubApi(input: {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): GitHubApi {
  if (!input.token.trim()) throw new Error('GitHub token is required.');
  const baseUrl = input.baseUrl ?? 'https://api.github.com';
  const parsedBaseUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol))
    throw new Error('GitHub API base URL must use HTTP(S).');
  const fetchImpl = input.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(new URL(path, parsedBaseUrl), {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${input.token}`,
        'x-github-api-version': '2022-11-28',
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new GitHubApiError(
        `GitHub API request failed with status ${response.status}.`,
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    createBranch: async (repository, branch, baseCommitSha) => {
      await request(githubPath(repository, '/git/refs'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseCommitSha }),
      });
    },
    getCiEvidence: async (repository, ref) => {
      const result = await request<{
        sha: string;
        check_runs: Array<{
          name: string;
          status: string;
          conclusion: string | null;
          html_url?: string;
        }>;
      }>(githubPath(repository, `/commits/${encodeURIComponent(ref)}/check-runs?per_page=100`));
      const checks = result.check_runs.map((check) => ({
        name: check.name,
        status:
          check.status === 'completed'
            ? ('COMPLETED' as const)
            : check.status === 'queued'
              ? ('QUEUED' as const)
              : ('IN_PROGRESS' as const),
        conclusion: check.conclusion,
        url: check.html_url,
      }));
      return { commitSha: result.sha, status: ciStatus(checks), checks };
    },
    createPullRequest: async (input) => {
      const result = await request<{
        number: number;
        html_url: string;
        head: { ref: string };
        base: { ref: string };
        state: string;
      }>(githubPath(input.repository, '/pulls'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          head: input.head,
          base: input.base,
          body: input.body,
        }),
      });
      return {
        number: result.number,
        url: result.html_url,
        head: result.head.ref,
        base: result.base.ref,
        state: result.state.toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED',
      };
    },
  };
}

export async function prepareTaskWorkspace(
  provider: GitProvider,
  repository: RepositoryConnection,
  request: WorkspaceRequest,
): Promise<WorkspaceArtifact> {
  const branch = branchName(request);
  await provider.createBranch(repository, branch, request.baseCommitSha);
  return {
    taskId: request.taskId,
    branch,
    workspace: workspacePath(request.taskId),
    baseCommitSha: request.baseCommitSha,
  };
}

export async function recordWorkspaceDiff(
  provider: GitProvider,
  artifact: WorkspaceArtifact,
): Promise<WorkspaceArtifact> {
  const result = await provider.collectDiff(artifact.workspace);
  return { ...artifact, candidateCommitSha: result.candidateCommitSha, diff: result.diff };
}
