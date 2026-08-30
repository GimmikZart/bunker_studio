import { describe, expect, it } from 'vitest';
import {
  branchName,
  prepareTaskWorkspace,
  recordWorkspaceDiff,
  validateWorkspaceIsolation,
  workspacePath,
} from './index';

describe('Git workspace safety', () => {
  it('creates deterministic task branches and isolated paths', () => {
    expect(branchName({ projectSlug: 'demo', taskId: 'task-1' })).toBe('bunker/demo/task-1-work');
    expect(workspacePath('run-1')).toBe('/workspaces/run-1');
  });

  it('rejects overlapping concurrent write scopes', () => {
    expect(() =>
      validateWorkspaceIsolation([
        {
          projectSlug: 'demo',
          taskId: 'a',
          baseCommitSha: 'sha',
          readScope: [],
          writeScope: ['src'],
        },
        {
          projectSlug: 'demo',
          taskId: 'b',
          baseCommitSha: 'sha',
          readScope: [],
          writeScope: ['src/ui'],
        },
      ]),
    ).toThrow();
  });

  it('preserves branch, workspace and candidate diff as an artifact', async () => {
    const calls: string[] = [];
    const provider = {
      createBranch: async (_repository: unknown, branch: string, sha: string) => {
        calls.push(`${branch}:${sha}`);
      },
      collectDiff: async (workspace: string) => ({
        candidateCommitSha: 'candidate',
        diff: `${workspace}:diff`,
      }),
    };
    const artifact = await prepareTaskWorkspace(
      provider,
      {
        id: 'repo',
        providerType: 'GITHUB',
        owner: 'o',
        name: 'r',
        defaultBranch: 'main',
        status: 'CONNECTED',
      },
      {
        projectSlug: 'demo',
        taskId: 'task-1',
        baseCommitSha: 'base',
        readScope: [],
        writeScope: [],
      },
    );
    expect(calls[0]).toContain('base');
    expect(await recordWorkspaceDiff(provider, artifact)).toMatchObject({
      candidateCommitSha: 'candidate',
      diff: '/workspaces/task-1:diff',
    });
  });
});
