import { describe, expect, it } from 'vitest';
import {
  budgetAllows,
  eligibleTasks,
  groupParallelTasks,
  nextQuotaRetryAt,
  transitionTask,
} from './index';

describe('deterministic orchestration', () => {
  it('enforces dependencies before scheduling', () => {
    const tasks = [
      {
        id: 'schema',
        state: 'READY' as const,
        dependencies: [],
        writeScope: ['db/schema'],
        estimatedCost: 1,
      },
      {
        id: 'backend',
        state: 'READY' as const,
        dependencies: ['schema'],
        writeScope: ['src/api'],
        estimatedCost: 1,
      },
    ];
    expect(eligibleTasks(tasks, 5).map((task) => task.id)).toEqual(['schema']);
    expect(
      eligibleTasks(
        tasks.map((task) => (task.id === 'schema' ? { ...task, state: 'DONE' as const } : task)),
        5,
      ).map((task) => task.id),
    ).toEqual(['backend']);
  });

  it('parallelizes disjoint scopes and serializes overlap', () => {
    const tasks = ['frontend', 'backend', 'shared'].map((id) => ({
      id,
      state: 'READY' as const,
      dependencies: [],
      writeScope: id === 'frontend' ? ['src/ui'] : id === 'backend' ? ['src/api'] : ['src'],
      estimatedCost: 1,
    }));
    expect(groupParallelTasks(tasks).map((group) => group.map((task) => task.id))).toEqual([
      ['frontend', 'backend'],
      ['shared'],
    ]);
  });

  it('enforces budget before provider invocation and computes quota polling', () => {
    expect(budgetAllows(5, 4)).toBe(false);
    expect(nextQuotaRetryAt(new Date('2026-01-01T00:00:00Z'), 0).toISOString()).toBe(
      '2026-01-01T00:15:00.000Z',
    );
  });

  it('only applies allowed state transitions', () => {
    expect(
      transitionTask(
        { id: 'x', state: 'READY', dependencies: [], writeScope: [], estimatedCost: 0 },
        'QUEUED',
      ).state,
    ).toBe('QUEUED');
    expect(
      transitionTask(
        { id: 'x', state: 'RUNNING', dependencies: [], writeScope: [], estimatedCost: 0 },
        'QUEUED',
      ).state,
    ).toBe('QUEUED');
    expect(() =>
      transitionTask(
        { id: 'x', state: 'DONE', dependencies: [], writeScope: [], estimatedCost: 0 },
        'RUNNING',
      ),
    ).toThrow();
  });
});
