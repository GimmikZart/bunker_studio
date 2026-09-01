import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorkerServiceSupabaseClient: vi.fn(),
}));

vi.mock('../../../../_supabase', () => mocks);

import { POST } from './route';

describe('local worker lease renewal route', () => {
  it('renews an active lease through the worker credential boundary', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          authenticated: true,
          renewed: true,
          lease_expires_at: '2026-09-01T12:00:00.000Z',
        },
      ],
      error: null,
    }));
    mocks.createWorkerServiceSupabaseClient.mockReturnValue({ rpc });
    const response = await POST(
      new Request('http://localhost/api/workers/runtime/tasks/renew', {
        method: 'POST',
        headers: { authorization: 'Bearer credential' },
        body: JSON.stringify({
          nodeId: '55555555-5555-4555-8555-555555555555',
          leaseId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ leaseExpiresAt: '2026-09-01T12:00:00.000Z' });
    expect(rpc).toHaveBeenCalledWith(
      'renew_local_worker_lease',
      expect.objectContaining({ p_lease_seconds: 120 }),
    );
  });
});
