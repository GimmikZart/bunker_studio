import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorkerServiceSupabaseClient: vi.fn(),
}));

vi.mock('../../../../_supabase', () => mocks);

import { POST } from './route';

describe('local worker task completion route', () => {
  it('completes an active lease through the credential boundary', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          authenticated: true,
          completed: true,
          task_id: '22222222-2222-4222-8222-222222222222',
          task_state: 'IMPLEMENTED',
          retry_count: 0,
        },
      ],
      error: null,
    }));
    mocks.createWorkerServiceSupabaseClient.mockReturnValue({ rpc });
    const response = await POST(
      new Request('http://localhost/api/workers/runtime/tasks/complete', {
        method: 'POST',
        headers: { authorization: 'Bearer credential' },
        body: JSON.stringify({
          nodeId: '55555555-5555-4555-8555-555555555555',
          leaseId: '11111111-1111-4111-8111-111111111111',
          success: true,
          result: { text: 'done' },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      task: { id: '22222222-2222-4222-8222-222222222222', state: 'IMPLEMENTED', retryCount: 0 },
    });
    expect(rpc).toHaveBeenCalledWith(
      'complete_local_worker_task',
      expect.objectContaining({
        p_success: true,
        p_lease_id: '11111111-1111-4111-8111-111111111111',
      }),
    );
  });
});
