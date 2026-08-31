import { describe, expect, it, vi } from 'vitest';
import { createRuntimeWorkerClient } from './runtime-client';

describe('runtime worker control-plane client', () => {
  it('registers and heartbeats without logging or altering credentials', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ worker: { id: 'node-1' }, credential: 'credential-1' }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ worker: { id: 'node-1' } }), { status: 200 }),
      );
    const client = createRuntimeWorkerClient({ baseUrl: 'http://localhost:3000/', fetchImpl });
    const identity = await client.register({
      name: 'Ollama node',
      capabilities: ['ollama', 'chat'],
      registrationToken: 'registration-token',
    });
    await client.heartbeat(identity.nodeId, identity.credential);
    expect(identity).toEqual({ nodeId: 'node-1', credential: 'credential-1' });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/workers/runtime/heartbeat',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer credential-1' }),
      }),
    );
  });

  it('rejects invalid control-plane URLs and failed responses', async () => {
    expect(() => createRuntimeWorkerClient({ baseUrl: 'file:///worker' })).toThrow(/HTTP/);
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    await expect(
      createRuntimeWorkerClient({ baseUrl: 'https://studio.example', fetchImpl }).heartbeat(
        'node-1',
        'credential',
      ),
    ).rejects.toThrow('status 401');
  });

  it('pulls a task and reports its completion through the credential boundary', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task: {
              leaseId: '11111111-1111-4111-8111-111111111111',
              taskId: '22222222-2222-4222-8222-222222222222',
              organizationId: '33333333-3333-4333-8333-333333333333',
              projectId: '44444444-4444-4444-8444-444444444444',
              title: 'Task',
              description: '',
              taskType: 'BACKEND',
              state: 'RUNNING',
              readScope: [],
              writeScope: [],
              definitionOfDone: {},
              attemptNumber: 1,
              leaseExpiresAt: new Date().toISOString(),
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task: {
              id: '22222222-2222-4222-8222-222222222222',
              state: 'IMPLEMENTED',
              retryCount: 0,
            },
          }),
          { status: 200 },
        ),
      );
    const client = createRuntimeWorkerClient({ baseUrl: 'http://localhost:3000', fetchImpl });
    const claimed = await client.claimTask('55555555-5555-4555-8555-555555555555', 'credential');
    expect(claimed?.taskId).toBe('22222222-2222-4222-8222-222222222222');
    await expect(
      client.completeTask({
        nodeId: '55555555-5555-4555-8555-555555555555',
        credential: 'credential',
        leaseId: claimed!.leaseId,
        success: true,
        result: { text: 'done' },
      }),
    ).resolves.toMatchObject({ state: 'IMPLEMENTED' });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/workers/runtime/tasks/complete',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer credential' }),
      }),
    );
  });
});
