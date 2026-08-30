import { describe, expect, it } from 'vitest';
import { DurableQueue } from '@bunker-studio/orchestration';
import { WorkerLoop } from './runner';

describe('worker loop', () => {
  it('completes a claimed job and does not invoke it twice', async () => {
    const queue = new DurableQueue();
    queue.enqueue({ operationKey: 'one', type: 'task.run', payload: {}, availableAt: 0 });
    let invocations = 0;
    const worker = new WorkerLoop(queue, {
      'task.run': () => {
        invocations += 1;
      },
    });
    expect(await worker.runOnce()).toBe('COMPLETED');
    expect(await worker.runOnce()).toBe('IDLE');
    expect(invocations).toBe(1);
  });

  it('reschedules failures when the queue supports release', async () => {
    const queue = new DurableQueue();
    queue.enqueue({ operationKey: 'retry', type: 'task.run', payload: {}, availableAt: 0 });
    const worker = new WorkerLoop(
      queue,
      { 'task.run': () => Promise.reject(new Error('transient')) },
      { retryDelayMs: 10 },
    );
    expect(await worker.runOnce()).toBe('RETRY_SCHEDULED');
    expect(queue.pendingCount()).toBe(1);
  });
});
