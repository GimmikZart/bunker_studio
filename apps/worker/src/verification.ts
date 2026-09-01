import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { VerificationCommand } from '@bunker-studio/contracts';

export type VerificationEvidence = {
  kind: VerificationCommand['kind'];
  command: string;
  status: 'PASS' | 'FAIL';
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
};

type LaunchResult = { exitCode: number | null; timedOut: boolean };
export type VerificationLauncher = (input: {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}) => Promise<LaunchResult>;

const SAFE_ENVIRONMENT_KEYS = [
  'APPDATA',
  'COMSPEC',
  'HOME',
  'LOCALAPPDATA',
  'PATH',
  'PATHEXT',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'USERPROFILE',
] as const;

export const DEFAULT_ALLOWED_VERIFICATION_EXECUTABLES = ['pnpm', 'npm', 'yarn', 'bun', 'node'];

export function verificationEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    SAFE_ENVIRONMENT_KEYS.flatMap((key) =>
      typeof environment[key] === 'string' ? [[key, environment[key]]] : [],
    ),
  );
}

export function parseAllowedExecutables(value?: string): string[] {
  const entries = (value?.trim() ? value.split(',') : DEFAULT_ALLOWED_VERIFICATION_EXECUTABLES)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(entries)];
}

const WINDOWS_PACKAGE_MANAGER_SCRIPTS: Record<string, string[]> = {
  pnpm: ['node_modules/corepack/dist/pnpm.js', 'node_modules/pnpm/bin/pnpm.cjs'],
  npm: ['node_modules/npm/bin/npm-cli.js'],
  yarn: ['node_modules/corepack/dist/yarn.js'],
};

export function resolveVerificationProcess(input: {
  executable: string;
  args: string[];
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  nodeExecutable?: string;
  exists?: (candidate: string) => boolean;
}): { executable: string; args: string[] } {
  const platform = input.platform ?? process.platform;
  if (platform !== 'win32') return { executable: input.executable, args: input.args };
  const pathApi = path.win32;
  const executable = input.executable.toLowerCase();
  const nodeExecutable = input.nodeExecutable ?? process.execPath;
  if (executable === 'node') return { executable: nodeExecutable, args: input.args };
  const exists = input.exists ?? existsSync;
  const pathEntries = (input.environment?.PATH ?? process.env.PATH ?? '')
    .split(pathApi.delimiter)
    .filter(Boolean);
  for (const directory of pathEntries) {
    const nativeExecutable = pathApi.join(directory, `${input.executable}.exe`);
    if (exists(nativeExecutable)) return { executable: nativeExecutable, args: input.args };
  }
  const scripts = WINDOWS_PACKAGE_MANAGER_SCRIPTS[executable] ?? [];
  const roots = [pathApi.dirname(nodeExecutable), ...pathEntries];
  for (const root of roots) {
    for (const relativeScript of scripts) {
      const script = pathApi.join(root, relativeScript);
      if (exists(script)) return { executable: nodeExecutable, args: [script, ...input.args] };
    }
  }
  return { executable: input.executable, args: input.args };
}

export const launchVerificationCommand: VerificationLauncher = (input) =>
  new Promise((resolve) => {
    const processCommand = resolveVerificationProcess({
      executable: input.executable,
      args: input.args,
      environment: input.env,
    });
    execFile(
      processCommand.executable,
      processCommand.args,
      {
        cwd: input.cwd,
        env: input.env,
        timeout: input.timeoutMs,
        maxBuffer: 1_000_000,
        windowsHide: true,
      },
      (error) => {
        if (!error) {
          resolve({ exitCode: 0, timedOut: false });
          return;
        }
        const failure = error as NodeJS.ErrnoException & {
          code?: string | number;
          killed?: boolean;
          signal?: string;
        };
        resolve({
          exitCode: typeof failure.code === 'number' ? failure.code : null,
          timedOut: failure.killed === true || failure.signal === 'SIGTERM',
        });
      },
    );
  });

export async function runVerificationPlan(input: {
  commands: VerificationCommand[];
  cwd: string;
  allowedExecutables: string[];
  environment?: NodeJS.ProcessEnv;
  launcher?: VerificationLauncher;
  now?: () => number;
}): Promise<VerificationEvidence[]> {
  const allowed = new Set(input.allowedExecutables.map((entry) => entry.toLowerCase()));
  const launcher = input.launcher ?? launchVerificationCommand;
  const now = input.now ?? Date.now;
  const evidence: VerificationEvidence[] = [];

  for (const command of input.commands) {
    if (!allowed.has(command.executable.toLowerCase()))
      throw new Error(`Verification executable "${command.executable}" is not allowed.`);
    const startedAt = now();
    const result = await launcher({
      executable: command.executable,
      args: command.args,
      cwd: input.cwd,
      timeoutMs: command.timeoutMs,
      env: verificationEnvironment(input.environment),
    });
    const entry: VerificationEvidence = {
      kind: command.kind,
      // Arguments may contain credentials. The structured task plan retains them for execution,
      // while durable evidence records only the executable and argument count.
      command: `${command.executable} (${command.args.length} args)`,
      status: result.exitCode === 0 && !result.timedOut ? 'PASS' : 'FAIL',
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: Math.max(0, now() - startedAt),
    };
    evidence.push(entry);
    if (entry.status === 'FAIL') break;
  }
  return evidence;
}
