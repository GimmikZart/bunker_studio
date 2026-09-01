import { describe, expect, it } from 'vitest';
import {
  gitPushArguments,
  githubGitEnvironment,
  pathWithinScopes,
  taskWorkspace,
} from './git-workspace';
import type { LocalWorkerTask } from './runtime-client';

const task = {
  taskId: '22222222-2222-4222-8222-222222222222',
  repository: {
    providerType: 'GITHUB',
    owner: 'studio-owner',
    name: 'sample-repo',
    defaultBranch: 'main',
    status: 'CONNECTED',
    credential: 'github-secret',
  },
} as LocalWorkerTask;

describe('Git task workspace security', () => {
  it('keeps task paths below the configured root and credentials out of repository URLs', () => {
    const workspace = taskWorkspace(task, 'C:/bunker/workspaces');
    expect(workspace.path.replace(/\\/g, '/')).toContain('/bunker/workspaces/22222222-');
    expect(workspace.repositoryUrl).toBe('https://github.com/studio-owner/sample-repo.git');
    expect(workspace.repositoryUrl).not.toContain('github-secret');
    expect(workspace.gitEnvironment.GIT_CONFIG_VALUE_0).not.toBe('github-secret');
  });

  it('rejects traversal and enforces declared write scopes', () => {
    expect(() => taskWorkspace({ ...task, taskId: '..' }, 'C:/bunker/workspaces')).toThrow(
      /unsafe/,
    );
    expect(pathWithinScopes('apps/web/page.tsx', ['apps/web'])).toBe(true);
    expect(pathWithinScopes('packages/db/index.ts', ['apps/web'])).toBe(false);
  });

  it('does not place the raw token in inherited Git configuration keys', () => {
    const environment = githubGitEnvironment('github-secret');
    expect(environment.GIT_CONFIG_KEY_0).toContain('extraheader');
    expect(environment.GIT_CONFIG_VALUE_0).not.toContain('github-secret');
  });

  it('uses force-with-lease only for a task branch that already exists remotely', () => {
    const workspace = taskWorkspace(task, 'C:/bunker/workspaces');
    expect(gitPushArguments(workspace)).toEqual([
      'push',
      '--set-upstream',
      'origin',
      workspace.branch,
    ]);
    workspace.remoteBranchSha = 'previous-candidate-sha';
    expect(gitPushArguments(workspace)).toContain(
      `--force-with-lease=refs/heads/${workspace.branch}:previous-candidate-sha`,
    );
  });
});
