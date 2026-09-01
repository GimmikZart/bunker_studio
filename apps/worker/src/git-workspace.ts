import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { LocalWorkerTask } from './runtime-client.js';

const execFileAsync = promisify(execFile);
const SAFE_REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]+$/;

export type TaskWorkspace = {
  path: string;
  branch: string;
  repositoryUrl: string;
  gitEnvironment: NodeJS.ProcessEnv;
};

function safeSegment(value: string, label: string): string {
  if (!SAFE_REPOSITORY_SEGMENT.test(value) || value === '.' || value === '..')
    throw new Error(`The repository ${label} is unsafe.`);
  return value;
}

export function normalizedScope(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+|\/+$/g, '');
}

export function pathWithinScopes(path: string, scopes: string[]): boolean {
  const normalizedPath = normalizedScope(path);
  return scopes.some((scope) => {
    const normalized = normalizedScope(scope);
    return (
      normalized && (normalizedPath === normalized || normalizedPath.startsWith(`${normalized}/`))
    );
  });
}

export function githubGitEnvironment(token: string): NodeJS.ProcessEnv {
  if (!token.trim()) throw new Error('A GitHub repository credential is required to push work.');
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
    GIT_TERMINAL_PROMPT: '0',
  };
}

export function taskWorkspace(task: LocalWorkerTask, workspaceRoot: string): TaskWorkspace {
  if (!task.repository || task.repository.providerType !== 'GITHUB')
    throw new Error('A GitHub repository must be connected to this project.');
  if (task.repository.status !== 'CONNECTED' || !task.repository.credential)
    throw new Error('The GitHub repository needs a valid credential.');
  const root = resolve(workspaceRoot);
  const taskId = safeSegment(task.taskId, 'task identifier');
  const path = resolve(root, taskId);
  if (path === root || !path.startsWith(`${root}${sep}`))
    throw new Error('The task workspace escaped its configured root.');
  const owner = safeSegment(task.repository.owner, 'owner');
  const name = safeSegment(task.repository.name, 'name');
  return {
    path,
    branch: `bunker/${taskId}`,
    repositoryUrl: `https://github.com/${owner}/${name}.git`,
    gitEnvironment: githubGitEnvironment(task.repository.credential),
  };
}

async function git(workspace: string | undefined, environment: NodeJS.ProcessEnv, args: string[]) {
  const result = await execFileAsync('git', args, {
    cwd: workspace,
    env: environment,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout;
}

export async function prepareGitWorkspace(
  task: LocalWorkerTask,
  workspaceRoot: string,
): Promise<TaskWorkspace> {
  const workspace = taskWorkspace(task, workspaceRoot);
  await rm(workspace.path, { recursive: true, force: true });
  await git(undefined, workspace.gitEnvironment, [
    'clone',
    '--no-tags',
    '--branch',
    task.repository!.defaultBranch,
    '--single-branch',
    workspace.repositoryUrl,
    workspace.path,
  ]);
  await git(workspace.path, workspace.gitEnvironment, ['checkout', '-b', workspace.branch]);
  return workspace;
}

function changedPaths(output: string): string[] {
  return output
    .split('\0')
    .map((path) => path.trim())
    .filter(Boolean);
}

export async function publishGitWorkspace(
  task: LocalWorkerTask,
  workspace: TaskWorkspace,
): Promise<{ branch: string; candidateCommitSha: string; changedFiles: string[]; diff: string }> {
  const [tracked, untracked] = await Promise.all([
    git(workspace.path, workspace.gitEnvironment, ['diff', '--name-only', '-z', 'HEAD']),
    git(workspace.path, workspace.gitEnvironment, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
    ]),
  ]);
  const changedFiles = [...new Set([...changedPaths(tracked), ...changedPaths(untracked)])];
  if (!changedFiles.length) throw new Error('The coding agent completed without changing files.');
  const outsideScope = changedFiles.filter((path) => !pathWithinScopes(path, task.writeScope));
  if (outsideScope.length)
    throw new Error(
      `The coding agent changed files outside its write scope: ${outsideScope.join(', ')}`,
    );
  await git(workspace.path, workspace.gitEnvironment, ['add', '--all']);
  const diff = await git(workspace.path, workspace.gitEnvironment, [
    'diff',
    '--cached',
    '--binary',
  ]);
  await git(workspace.path, workspace.gitEnvironment, [
    '-c',
    'user.name=Bunker Studio Worker',
    '-c',
    'user.email=worker@bunker.studio',
    'commit',
    '-m',
    `Bunker task ${task.taskId}: ${task.title.slice(0, 120)}`,
  ]);
  const candidateCommitSha = (
    await git(workspace.path, workspace.gitEnvironment, ['rev-parse', 'HEAD'])
  ).trim();
  await git(workspace.path, workspace.gitEnvironment, [
    'push',
    '--set-upstream',
    'origin',
    workspace.branch,
  ]);
  return { branch: workspace.branch, candidateCommitSha, changedFiles, diff };
}

export async function cleanupGitWorkspace(workspace: TaskWorkspace): Promise<void> {
  await rm(workspace.path, { recursive: true, force: true });
}
