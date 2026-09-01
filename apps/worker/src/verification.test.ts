import { describe, expect, it, vi } from 'vitest';
import {
  parseAllowedExecutables,
  resolveVerificationProcess,
  runVerificationPlan,
  verificationEnvironment,
} from './verification';

const command = {
  kind: 'UNIT' as const,
  executable: 'pnpm',
  args: ['test'],
  timeoutMs: 30_000,
};

describe('deterministic task verification', () => {
  it('runs an allowlisted command without a shell and records bounded evidence', async () => {
    const launcher = vi.fn(async () => ({ exitCode: 0, timedOut: false }));
    let time = 100;
    const evidence = await runVerificationPlan({
      commands: [command],
      cwd: 'C:/workspace',
      allowedExecutables: ['pnpm'],
      launcher,
      now: () => (time += 25),
      environment: { PATH: 'bin', STUDIO_MASTER_KEY: 'must-not-leak' },
    });
    expect(launcher).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: 'pnpm',
        args: ['test'],
        cwd: 'C:/workspace',
        timeoutMs: 30_000,
        env: { PATH: 'bin' },
      }),
    );
    expect(evidence).toEqual([
      {
        kind: 'UNIT',
        command: 'pnpm (1 args)',
        status: 'PASS',
        exitCode: 0,
        timedOut: false,
        durationMs: 25,
      },
    ]);
  });

  it('fails fast on non-zero exit and timeout', async () => {
    const launcher = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, timedOut: false })
      .mockResolvedValueOnce({ exitCode: null, timedOut: true });
    const first = await runVerificationPlan({
      commands: [command, { ...command, kind: 'BUILD' }],
      cwd: 'C:/workspace',
      allowedExecutables: ['pnpm'],
      launcher,
    });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ status: 'FAIL', exitCode: 1, timedOut: false });

    const timedOut = await runVerificationPlan({
      commands: [command],
      cwd: 'C:/workspace',
      allowedExecutables: ['pnpm'],
      launcher,
    });
    expect(timedOut[0]).toMatchObject({ status: 'FAIL', exitCode: null, timedOut: true });
  });

  it('rejects executables outside the worker allowlist', async () => {
    await expect(
      runVerificationPlan({
        commands: [{ ...command, executable: 'powershell' }],
        cwd: 'C:/workspace',
        allowedExecutables: ['pnpm'],
      }),
    ).rejects.toThrow('not allowed');
  });

  it('launches Windows package-manager JavaScript shims through Node without a shell', () => {
    const nodeExecutable = 'C:\\Program Files\\nodejs\\node.exe';
    const pnpmScript = 'C:\\Program Files\\nodejs\\node_modules\\corepack\\dist\\pnpm.js';
    expect(
      resolveVerificationProcess({
        executable: 'pnpm',
        args: ['run', 'test'],
        platform: 'win32',
        nodeExecutable,
        environment: { PATH: 'C:\\Program Files\\nodejs' },
        exists: (candidate) => candidate === pnpmScript,
      }),
    ).toEqual({ executable: nodeExecutable, args: [pnpmScript, 'run', 'test'] });
  });

  it('does not expose secrets from environment or command arguments in evidence', async () => {
    const secret = 'super-secret-value';
    expect(
      verificationEnvironment({
        PATH: 'bin',
        OPENAI_API_KEY: secret,
        WORKER_CREDENTIAL: secret,
        DATABASE_URL: secret,
      }),
    ).toEqual({ PATH: 'bin' });
    const evidence = await runVerificationPlan({
      commands: [{ ...command, args: ['test', `--token=${secret}`] }],
      cwd: 'C:/workspace',
      allowedExecutables: parseAllowedExecutables('pnpm'),
      launcher: async () => ({ exitCode: 0, timedOut: false }),
    });
    expect(JSON.stringify(evidence)).not.toContain(secret);
  });
});
