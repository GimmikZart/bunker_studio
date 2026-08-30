import { describe, expect, it } from 'vitest';
import { createPersistentWorker } from './persistent';

describe('persistent worker composition', () => {
  it('wires pg-boss and outbox dependencies without provider-specific handlers', async () => {
    let completed = '';
    const boss = {
      send: async () => 'job-1',
      fetch: async () => ({
        id: 'job-1',
        name: 'tasks',
        data: { operationKey: 'one', type: 'task.run', payload: {}, availableAt: 0 },
      }),
      complete: async (_name: string, id: string) => {
        completed = id;
      },
    };
    const { worker, dispatcher } = createPersistentWorker({
      boss,
      outbox: {
        claim: async () => ({
          id: 'event-1',
          event_type: 'task.run',
          payload_json: {},
          available_at: new Date(0).toISOString(),
        }),
        markProcessed: async () => undefined,
      },
      handlers: { 'task.run': async () => undefined },
    });
    expect(await worker.runOnce()).toBe('COMPLETED');
    expect(completed).toBe('job-1');
    expect((await dispatcher.dispatchOne(new Date(0)))?.type).toBe('task.run');
  });
});
