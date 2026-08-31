import { describe, expect, it, vi } from 'vitest';
import { createPgBossClient, type PgBossLike } from './pg-boss';

describe('pg-boss process adapter', () => {
  it('normalizes pg-boss batch jobs without leaking unknown payloads', async () => {
    const complete = vi.fn(async () => ({}) as never);
    const fail = vi.fn(async () => ({}) as never);
    const deleteJob = vi.fn(async () => ({}) as never);
    const client = createPgBossClient({
      send: async () => 'job-1',
      fetch: async () => [
        { id: 'job-1', name: 'queue', data: { operationKey: 'one' } },
        { id: 'job-2', name: 'queue', data: 'invalid' },
      ],
      complete,
      fail,
      deleteJob,
    } as unknown as PgBossLike);

    await expect(client.fetch('queue', { batchSize: 1 })).resolves.toEqual([
      { id: 'job-1', name: 'queue', data: { operationKey: 'one' } },
      { id: 'job-2', name: 'queue', data: {} },
    ]);
    await client.complete('queue', 'job-1');
    await client.fail?.('queue', 'job-1', 'temporary failure');
    await client.deleteJob?.('queue', 'job-1');
    expect(complete).toHaveBeenCalledWith('queue', 'job-1');
    expect(fail).toHaveBeenCalledWith('queue', 'job-1', { message: 'temporary failure' });
    expect(deleteJob).toHaveBeenCalledWith('queue', 'job-1');
  });
});
