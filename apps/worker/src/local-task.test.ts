import { describe, expect, it, vi } from 'vitest';
import { LocalWorkerTaskLoop, TaskExecutionError } from './local-task';
import type { RuntimeWorkerClient } from './runtime-client';

const task = {
  leaseId: '11111111-1111-4111-8111-111111111111',
  taskId: '22222222-2222-4222-8222-222222222222',
  organizationId: '33333333-3333-4333-8333-333333333333',
  projectId: '44444444-4444-4444-8444-444444444444',
  title: 'Local task',
  description: 'Run locally',
  taskType: 'BACKEND',
  state: 'RUNNING',
  readScope: ['packages/core'],
  writeScope: ['packages/core/src'],
  definitionOfDone: { items: ['tests pass'] },
  verificationCommands: [
    { kind: 'UNIT' as const, executable: 'pnpm', args: ['test'], timeoutMs: 300_000 },
  ],
  requiredCapability: 'ollama',
  attemptNumber: 1,
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  agent: {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Builder',
    role_key: 'backend',
    title: 'Backend Engineer',
    personality_json: {},
    skills_json: ['backend'],
    tools_json: ['repository.workspace'],
    permissions_json: ['repo.read', 'repo.write'],
  },
  binding: {
    id: '77777777-7777-4777-8777-777777777777',
    providerConnectionId: '88888888-8888-4888-8888-888888888888',
    providerModelId: 'test-model',
    runtimeType: 'OPENAI' as const,
    reasoningEffort: 'medium' as const,
  },
  provider: {
    type: 'OPENAI' as const,
    displayName: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: 'provider-secret',
  },
  repository: null,
};

function client(overrides: Partial<RuntimeWorkerClient> = {}): RuntimeWorkerClient {
  return {
    register: vi.fn(),
    heartbeat: vi.fn(),
    claimTask: vi.fn(),
    renewLease: vi.fn(),
    completeTask: vi.fn(),
    ...overrides,
  } as unknown as RuntimeWorkerClient;
}

describe('local worker task loop', () => {
  it('claims, executes and completes a task', async () => {
    const completeTask = vi.fn(async () => ({
      id: task.taskId,
      state: 'IMPLEMENTED',
      retryCount: 0,
    }));
    const controlPlane = client({
      claimTask: vi.fn(async () => task),
      completeTask,
    });
    const loop = new LocalWorkerTaskLoop(
      controlPlane,
      { nodeId: '55555555-5555-4555-8555-555555555555', credential: 'secret' },
      async (claimed) => ({ taskId: claimed.taskId, text: 'done' }),
    );
    await expect(loop.runOnce()).resolves.toBe('COMPLETED');
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ leaseId: task.leaseId, success: true }),
    );
  });

  it('reports executor failures and preserves retry state', async () => {
    const completeTask = vi.fn(async () => ({ id: task.taskId, state: 'QUEUED', retryCount: 1 }));
    const controlPlane = client({ claimTask: vi.fn(async () => task), completeTask });
    const loop = new LocalWorkerTaskLoop(
      controlPlane,
      { nodeId: '55555555-5555-4555-8555-555555555555', credential: 'secret' },
      async () => {
        throw new Error('provider unavailable');
      },
    );
    await expect(loop.runOnce()).resolves.toBe('RETRY_SCHEDULED');
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: task.leaseId,
        success: false,
        error: 'provider unavailable',
      }),
    );
  });

  it('persists safe verification evidence when deterministic checks fail', async () => {
    const completeTask = vi.fn(async () => ({ id: task.taskId, state: 'QUEUED', retryCount: 1 }));
    const controlPlane = client({ claimTask: vi.fn(async () => task), completeTask });
    const verification = [
      {
        kind: 'UNIT',
        command: 'pnpm (1 args)',
        status: 'FAIL',
        exitCode: 1,
        timedOut: false,
        durationMs: 42,
      },
    ];
    const loop = new LocalWorkerTaskLoop(
      controlPlane,
      { nodeId: '55555555-5555-4555-8555-555555555555', credential: 'secret' },
      async () => {
        throw new TaskExecutionError('Deterministic verification did not pass.', { verification });
      },
    );
    await expect(loop.runOnce()).resolves.toBe('RETRY_SCHEDULED');
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, result: { verification } }),
    );
  });

  it('preserves a completed publication if the first completion call is interrupted', async () => {
    const result = {
      branch: 'bunker/task',
      candidateCommitSha: 'candidate-sha',
      publicationStage: 'REVIEW_READY',
    };
    const completeTask = vi
      .fn()
      .mockRejectedValueOnce(new Error('control plane unavailable'))
      .mockResolvedValueOnce({ id: task.taskId, state: 'QUEUED', retryCount: 1 });
    const loop = new LocalWorkerTaskLoop(
      client({ claimTask: vi.fn(async () => task), completeTask }),
      { nodeId: '55555555-5555-4555-8555-555555555555', credential: 'secret' },
      async () => result,
    );
    await expect(loop.runOnce()).resolves.toBe('RETRY_SCHEDULED');
    expect(completeTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ success: false, result }),
    );
  });

  it('renews a task lease while an agent run is still active', async () => {
    vi.useFakeTimers();
    try {
      let resolveExecution!: (value: Record<string, unknown>) => void;
      const execution = new Promise<Record<string, unknown>>((resolve) => {
        resolveExecution = resolve;
      });
      const renewLease = vi.fn(async () => new Date(Date.now() + 120_000).toISOString());
      const completeTask = vi.fn(async () => ({
        id: task.taskId,
        state: 'IMPLEMENTED',
        retryCount: 0,
      }));
      const controlPlane = client({
        claimTask: vi.fn(async () => task),
        renewLease,
        completeTask,
      });
      const loop = new LocalWorkerTaskLoop(
        controlPlane,
        { nodeId: '55555555-5555-4555-8555-555555555555', credential: 'secret' },
        async () => execution,
        1_000,
      );
      const run = loop.runOnce();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(renewLease).toHaveBeenCalledWith(expect.objectContaining({ leaseId: task.leaseId }));
      resolveExecution({ text: 'done' });
      await expect(run).resolves.toBe('COMPLETED');
    } finally {
      vi.useRealTimers();
    }
  });
});
