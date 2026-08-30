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
