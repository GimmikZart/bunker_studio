import { describe, expect, it } from 'vitest';
import { DurableQueue, InMemoryOutbox, OutboxDispatcher, PgBossQueue } from './queue';

describe('durable queue contract', () => {
  it('deduplicates externally retried operations and supports at-least-once claims', () => {
    const queue = new DurableQueue();
    const first = queue.enqueue({
      operationKey: 'task-1',
      type: 'task.run',
      payload: { taskId: 'task-1' },
      availableAt: 0,
    });
    const duplicate = queue.enqueue({
      operationKey: 'task-1',
      type: 'task.run',
      payload: { taskId: 'task-1' },
      availableAt: 0,
    });
    expect(duplicate.id).toBe(first.id);
    expect(queue.claim(1)?.attempts).toBe(1);
    queue.complete(first.id, 2);
    expect(queue.pendingCount()).toBe(0);
  });

  it('reclaims an uncompleted lease after a worker restart', () => {
    const queue = new DurableQueue({ leaseMs: 10 });
    const job = queue.enqueue({
      operationKey: 'restart-1',
      type: 'task.run',
      payload: {},
      availableAt: 0,
    });
    expect(queue.claim(1)?.id).toBe(job.id);
    expect(queue.claim(5)).toBeNull();
    expect(queue.claim(11)?.id).toBe(job.id);
  });

  it('dispatches an outbox event exactly once into a queue operation', () => {
    const outbox = new InMemoryOutbox();
    const queue = new DurableQueue();
    const dispatcher = new OutboxDispatcher(outbox, queue);
    outbox.append({ eventType: 'task.run', payload: { taskId: 'task-1' }, availableAt: 0 });

    const job = dispatcher.dispatchOne(1);
    expect(job?.type).toBe('task.run');
    expect(dispatcher.dispatchOne(1)).toBeNull();
    expect(queue.pendingCount()).toBe(1);
  });

  it('maps pg-boss claims and uses singleton keys for idempotency', async () => {
    const sent: Array<{
      name: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }> = [];
    const boss = {
      send: async (
        name: string,
        data: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        sent.push({ name, data, options });
        return 'pg-job-1';
      },
      fetch: async () => ({
        id: 'pg-job-1',
        name: 'bunker-studio.tasks',
        data: {
          operationKey: 'task-1',
          type: 'task.run',
          payload: { taskId: 'task-1' },
          availableAt: 0,
        },
      }),
      complete: async () => undefined,
    };
    const queue = new PgBossQueue(boss);
    const created = await queue.enqueue({
      operationKey: 'task-1',
      type: 'task.run',
      payload: { taskId: 'task-1' },
      availableAt: 0,
    });
    expect(sent[0]?.options?.singletonKey).toBe('task-1');
    expect((await queue.claim())?.id).toBe(created.id);
  });

  it('accepts the array returned by pg-boss batch fetches', async () => {
    const queue = new PgBossQueue({
      send: async () => 'pg-job-2',
      fetch: async () => [
        {
          id: 'pg-job-2',
          name: 'bunker-studio.tasks',
          data: { operationKey: 'task-2', type: 'task.run', payload: {}, availableAt: 0 },
        },
      ],
      complete: async () => undefined,
    });
    expect((await queue.claim())?.operationKey).toBe('task-2');
  });

  it('uses one explicit retry operation after a failed pg-boss claim', async () => {
    const sent: Record<string, unknown>[] = [];
    const failed: string[] = [];
    const queue = new PgBossQueue({
      send: async (_name, data) => {
        sent.push(data);
        return sent.length === 1 ? 'pg-job-3' : 'pg-job-4';
      },
      fetch: async () => ({
        id: 'pg-job-3',
        name: 'bunker-studio.tasks',
        data: { operationKey: 'task-3', type: 'task.run', payload: {}, availableAt: 0 },
      }),
      complete: async () => undefined,
      fail: async (_name, id) => {
        failed.push(id);
      },
    });
    await queue.enqueue({
      operationKey: 'task-3',
      type: 'task.run',
      payload: {},
      availableAt: 0,
    });
    const claimed = await queue.claim();
    await queue.release(claimed!, 10, 'temporary');
    expect(failed).toEqual(['pg-job-3']);
    expect(sent.map((item) => item.operationKey)).toEqual(['task-3', 'task-3:retry:1']);
  });
});
