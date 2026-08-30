import { describe, expect, it } from 'vitest';
import { SupabaseOutboxRepository, type OutboxRow } from './outbox';

describe('Supabase outbox repository', () => {
  it('claims through the atomic database function and marks completion', async () => {
    const row: OutboxRow = {
      id: 'event-1',
      event_type: 'task.run',
      payload_json: { taskId: 'task-1' },
      available_at: new Date(0).toISOString(),
      processed_at: null,
      attempts: 1,
    };
    let marked = '';
    const repository = new SupabaseOutboxRepository({
      rpc: async (name) => ({ data: name === 'claim_outbox_event' ? [row] : [], error: null }),
      from: () => ({
        update: () => ({
          eq: async (_column: string, value: string) => {
            marked = value;
            return { error: null };
          },
        }),
      }),
    });
    expect((await repository.claim(new Date(0)))?.id).toBe('event-1');
    await repository.markProcessed('event-1');
    expect(marked).toBe('event-1');
  });
});
