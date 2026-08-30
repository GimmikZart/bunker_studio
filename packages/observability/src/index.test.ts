import { describe, expect, it } from 'vitest';
import { createLogger } from './index';

describe('structured observability', () => {
  it('preserves correlation context on every record', () => {
    const records: unknown[] = [];
    createLogger({ correlationId: 'corr-1', taskId: 'task-1' }, (record) =>
      records.push(record),
    ).info('task.started');
    expect(records[0]).toMatchObject({
      correlationId: 'corr-1',
      taskId: 'task-1',
      event: 'task.started',
    });
  });
});
