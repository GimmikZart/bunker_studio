import { describe, expect, it, vi } from 'vitest';
import { LocalWorkerTaskLoop } from './local-task';
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
  requiredCapability: 'ollama',
  attemptNumber: 1,
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function client(overrides: Partial<RuntimeWorkerClient> = {}): RuntimeWorkerClient {
  return {
    register: vi.fn(),
    heartbeat: vi.fn(),
    claimTask: vi.fn(),
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
});
