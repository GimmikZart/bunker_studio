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
});
