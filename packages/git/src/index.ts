export const PACKAGE_NAME = '@bunker-studio/git';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
  source: 'CHECK_RUN' | 'COMMIT_STATUS';
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED';
  conclusion: string | null;
  url?: string;
};

export type GitHubCiEvidence = {
  commitSha: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  checks: GitHubCheck[];
};

export type GitHubCiVerification = {
  kind: 'INTEGRATION';
  commandOrCheck: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  durationMs: 0;
  externalKey: string;
};

const MAX_GITHUB_CI_CHECKS = 200;

export function githubCiVerificationRuns(evidence: GitHubCiEvidence): GitHubCiVerification[] {
  if (!evidence.checks.length)
    return [
      {
        kind: 'INTEGRATION',
        commandOrCheck: 'GitHub CI: waiting for checks',
        status: 'PENDING',
        durationMs: 0,
        externalKey: `github:${evidence.commitSha}:discovery`,
      },
    ];
  return evidence.checks.slice(0, MAX_GITHUB_CI_CHECKS).map((check) => {
    const externalId = createHash('sha256').update(`${check.source}:${check.name}`).digest('hex');
    return {
      kind: 'INTEGRATION',
      commandOrCheck: `GitHub CI: ${check.name || 'unnamed check'}`.slice(0, 1_000),
      status:
        check.status !== 'COMPLETED'
          ? 'PENDING'
          : ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((check.conclusion ?? '').toUpperCase())
            ? 'PASS'
            : 'FAIL',
      durationMs: 0,
      externalKey: `github:${evidence.commitSha}:${externalId}`,
    };
  });
}

export type GitHubPullRequest = {
  number: number;
  url: string;
  head: string;
  headSha: string;
  base: string;
  state: 'OPEN' | 'CLOSED';
};

export type GitHubPullRequestFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

/** One page of files is enough context for a review and bounds the request. */
export const MAX_PULL_REQUEST_FILES = 100;

/** The account a token belongs to, used to name a connection in the studio. */
export type GitHubAccount = { login: string; type: 'USER' | 'ORGANIZATION' };

/** What a connected account exposes, so a project picks a repository from a list. */
export type GitHubRepositorySummary = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  pushedAt: string | null;
  canPush: boolean;
};

/** Three pages is enough for any studio and bounds an unattended listing. */
export const MAX_REPOSITORY_PAGES = 3;

export type GitHubApi = {
  getAuthenticatedAccount: () => Promise<GitHubAccount>;
  listAccessibleRepositories: () => Promise<GitHubRepositorySummary[]>;
  verifyRepositoryAccess: (
    repository: GitHubRepositoryRef,
    branch: string,
  ) => Promise<{ repositoryId: string; defaultBranch: string; canPush: boolean }>;
  createBranch: (
    repository: GitHubRepositoryRef,
    branch: string,
    baseCommitSha: string,
  ) => Promise<void>;
  getCiEvidence: (repository: GitHubRepositoryRef, ref: string) => Promise<GitHubCiEvidence>;
  findPullRequest: (input: {
    repository: GitHubRepositoryRef;
    head: string;
    base: string;
  }) => Promise<GitHubPullRequest | null>;
  createPullRequest: (input: {
    repository: GitHubRepositoryRef;
    head: string;
    base: string;
    title: string;
    body?: string;
  }) => Promise<GitHubPullRequest>;
  updatePullRequest: (input: {
    repository: GitHubRepositoryRef;
    number: number;
    base: string;
    title: string;
    body?: string;
  }) => Promise<GitHubPullRequest>;
  listPullRequestFiles: (input: {
    repository: GitHubRepositoryRef;
    number: number;
  }) => Promise<GitHubPullRequestFile[]>;
};

export type GitHubPullRequestPlan = {
  repository: GitHubRepositoryRef;
  head: string;
  expectedHeadSha: string;
  base: string;
  title: string;
  body?: string;
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
  if (!checks.length) return 'PENDING';
  if (
    checks.some(
      (check) =>
        check.status === 'COMPLETED' &&
        !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((check.conclusion ?? '').toUpperCase()),
    )
  )
    return 'FAIL';
  if (checks.some((check) => check.status !== 'COMPLETED')) return 'PENDING';
  return 'PASS';
}

function mapPullRequest(result: {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  state: string;
}): GitHubPullRequest {
  return {
    number: result.number,
    url: result.html_url,
    head: result.head.ref,
    headSha: result.head.sha,
    base: result.base.ref,
    state: result.state.toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED',
  };
}

export async function ensurePullRequest(
  api: GitHubApi,
  input: GitHubPullRequestPlan,
): Promise<{ pullRequest: GitHubPullRequest; created: boolean }> {
  const existing = await api.findPullRequest(input);
  const pullRequest = existing
    ? await api.updatePullRequest({
        repository: input.repository,
        number: existing.number,
        base: input.base,
        title: input.title,
        body: input.body,
      })
    : await api.createPullRequest(input);
  if (
    pullRequest.head !== input.head ||
    pullRequest.base !== input.base ||
    pullRequest.headSha !== input.expectedHeadSha
  )
    throw new Error('GitHub pull request does not match the candidate branch and commit.');
  return { pullRequest, created: !existing };
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
    getAuthenticatedAccount: async () => {
      const account = await request<{ login: string; type?: string }>('/user');
      return {
        login: account.login,
        type: (account.type ?? '').toLowerCase() === 'organization' ? 'ORGANIZATION' : 'USER',
      };
    },
    listAccessibleRepositories: async () => {
      const collected: GitHubRepositorySummary[] = [];
      for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
        const results = await request<
          Array<{
            name: string;
            full_name: string;
            owner?: { login?: string };
            default_branch?: string;
            private?: boolean;
            description?: string | null;
            pushed_at?: string | null;
            permissions?: { push?: boolean };
          }>
        >(`/user/repos?per_page=100&sort=pushed&page=${page}`);
        collected.push(
          ...results.map((item) => ({
            owner: item.owner?.login ?? item.full_name.split('/')[0] ?? '',
            name: item.name,
            fullName: item.full_name,
            defaultBranch: item.default_branch || 'main',
            private: item.private === true,
            description: item.description ?? null,
            pushedAt: item.pushed_at ?? null,
            canPush: item.permissions?.push === true,
          })),
        );
        if (results.length < 100) break;
      }
      return collected;
    },
    verifyRepositoryAccess: async (repository, branch) => {
      const metadata = await request<{
        id: number | string;
        default_branch: string;
        permissions?: { push?: boolean };
      }>(githubPath(repository, ''));
      await request(githubPath(repository, `/branches/${encodeURIComponent(branch)}`));
      return {
        repositoryId: String(metadata.id),
        defaultBranch: metadata.default_branch,
        canPush: metadata.permissions?.push === true,
      };
    },
    createBranch: async (repository, branch, baseCommitSha) => {
      await request(githubPath(repository, '/git/refs'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseCommitSha }),
      });
    },
    getCiEvidence: async (repository, ref) => {
      const [checkRuns, combinedStatus] = await Promise.all([
        request<{
          sha: string;
          check_runs: Array<{
            name: string;
            status: string;
            conclusion: string | null;
            html_url?: string;
          }>;
        }>(githubPath(repository, `/commits/${encodeURIComponent(ref)}/check-runs?per_page=100`)),
        request<{
          sha: string;
          statuses: Array<{
            context: string;
            state: string;
            target_url?: string;
          }>;
        }>(githubPath(repository, `/commits/${encodeURIComponent(ref)}/status?per_page=100`)),
      ]);
      if (checkRuns.sha !== combinedStatus.sha)
        throw new Error('GitHub CI evidence returned inconsistent commit identifiers.');
      const checks: GitHubCheck[] = checkRuns.check_runs.map((check) => ({
        name: check.name,
        source: 'CHECK_RUN',
        status:
          check.status === 'completed'
            ? ('COMPLETED' as const)
            : check.status === 'queued'
              ? ('QUEUED' as const)
              : ('IN_PROGRESS' as const),
        conclusion: check.conclusion,
        url: check.html_url,
      }));
      checks.push(
        ...combinedStatus.statuses.map((status): GitHubCheck => {
          const state = status.state.toUpperCase();
          return {
            name: status.context,
            source: 'COMMIT_STATUS',
            status: state === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED',
            conclusion: state === 'SUCCESS' ? 'SUCCESS' : state === 'PENDING' ? null : 'FAILURE',
            url: status.target_url,
          };
        }),
      );
      return { commitSha: checkRuns.sha, status: ciStatus(checks), checks };
    },
    findPullRequest: async (input) => {
      const query = new URLSearchParams({
        state: 'all',
        head: `${input.repository.owner}:${input.head}`,
        base: input.base,
        per_page: '10',
      });
      const results = await request<
        Array<{
          number: number;
          html_url: string;
          head: { ref: string; sha: string };
          base: { ref: string };
          state: string;
        }>
      >(githubPath(input.repository, `/pulls?${query.toString()}`));
      const exact = results.find(
        (candidate) => candidate.head.ref === input.head && candidate.base.ref === input.base,
      );
      return exact ? mapPullRequest(exact) : null;
    },
    createPullRequest: async (input) => {
      const result = await request<{
        number: number;
        html_url: string;
        head: { ref: string; sha: string };
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
      return mapPullRequest(result);
    },
    updatePullRequest: async (input) => {
      const result = await request<{
        number: number;
        html_url: string;
        head: { ref: string; sha: string };
        base: { ref: string };
        state: string;
      }>(githubPath(input.repository, `/pulls/${input.number}`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          base: input.base,
          body: input.body,
          state: 'open',
        }),
      });
      return mapPullRequest(result);
    },
    listPullRequestFiles: async (input) => {
      if (!Number.isInteger(input.number) || input.number <= 0)
        throw new Error('A pull request number is required to list its files.');
      const files = await request<
        { filename: string; status: string; additions: number; deletions: number; patch?: string }[]
      >(
        githubPath(
          input.repository,
          `/pulls/${input.number}/files?per_page=${MAX_PULL_REQUEST_FILES}`,
        ),
      );
      return (Array.isArray(files) ? files : []).map((file) => ({
        filename: String(file.filename),
        status: String(file.status),
        additions: Number(file.additions) || 0,
        deletions: Number(file.deletions) || 0,
        ...(typeof file.patch === 'string' ? { patch: file.patch } : {}),
      }));
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
