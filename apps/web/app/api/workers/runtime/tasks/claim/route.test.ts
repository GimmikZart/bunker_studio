import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorkerServiceSupabaseClient: vi.fn(),
}));

vi.mock('../../../../_supabase', () => mocks);

import { POST } from './route';

describe('local worker task claim route', () => {
  it('returns a claimed task only after the credential is accepted', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          authenticated: true,
          lease_id: '11111111-1111-4111-8111-111111111111',
          task_id: '22222222-2222-4222-8222-222222222222',
          organization_id: '33333333-3333-4333-8333-333333333333',
          project_id: '44444444-4444-4444-8444-444444444444',
          title: 'Implement locally',
          description: 'Scoped task',
          task_type: 'BACKEND',
          task_state: 'RUNNING',
          read_scope_json: ['packages/core'],
          write_scope_json: ['packages/core/src'],
          definition_of_done_json: { items: ['tests pass'] },
          required_capability: 'ollama',
          attempt_number: 1,
          lease_expires_at: new Date().toISOString(),
        },
      ],
      error: null,
    }));
    mocks.createWorkerServiceSupabaseClient.mockReturnValue({ rpc });
    const response = await POST(
      new Request('http://localhost/api/workers/runtime/tasks/claim', {
        method: 'POST',
        headers: { authorization: 'Bearer credential' },
        body: JSON.stringify({ nodeId: '55555555-5555-4555-8555-555555555555' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      task: { taskId: '22222222-2222-4222-8222-222222222222' },
    });
    expect(rpc).toHaveBeenCalledWith(
      'claim_local_worker_task',
      expect.objectContaining({ p_node_id: '55555555-5555-4555-8555-555555555555' }),
    );
  });

  it('returns no task for an authenticated idle worker and rejects invalid credentials', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ authenticated: true, task_id: null }], error: null })
      .mockResolvedValueOnce({ data: [{ authenticated: false, task_id: null }], error: null });
    mocks.createWorkerServiceSupabaseClient.mockReturnValue({ rpc });
    const request = () =>
      new Request('http://localhost/api/workers/runtime/tasks/claim', {
        method: 'POST',
        headers: { authorization: 'Bearer credential' },
        body: JSON.stringify({ nodeId: '55555555-5555-4555-8555-555555555555' }),
      });
    await expect((await POST(request())).json()).resolves.toEqual({ task: null });
    expect((await POST(request())).status).toBe(401);
  });
});
