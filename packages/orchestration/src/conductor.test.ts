import { describe, expect, it } from 'vitest';
import { conductProject, type ConductorTask } from './conductor';

function task(overrides: Partial<ConductorTask> & { id: string }): ConductorTask {
  return {
    title: overrides.id,
    state: 'READY',
    dependencies: [],
    writeScope: [`packages/${overrides.id}`],
    estimatedCost: 1,
    assignedAgentId: 'agent-1',
    ...overrides,
  };
}

const conduct = (tasks: ConductorTask[], overrides = {}) =>
  conductProject({ autonomyMode: 'AUTONOMOUS', tasks, remainingBudget: null, ...overrides });

describe('the conductor', () => {
  it('starts work that is ready, and stops at the concurrency limit', () => {
    const plan = conduct([task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]);
    expect(plan.moves.filter((move) => move.to === 'QUEUED').map((move) => move.taskId)).toEqual([
      'a',
      'b',
    ]);
    expect(plan.holds).toEqual([
      { taskId: 'c', title: 'c', reason: 'Waiting for a free slot: 2 tasks already in flight.' },
    ]);
  });

  it('counts what is already running against the limit', () => {
    const plan = conduct([
      task({ id: 'a', state: 'RUNNING' }),
      task({ id: 'b' }),
      task({ id: 'c' }),
    ]);
    expect(plan.moves.filter((move) => move.to === 'QUEUED').map((move) => move.taskId)).toEqual([
      'b',
    ]);
  });

  it('parks a task behind the work it depends on, naming it', () => {
    const plan = conduct([
      task({ id: 'schema', title: 'Define the schema' }),
      task({ id: 'api', title: 'Build the API', dependencies: ['schema'] }),
    ]);
    const parked = plan.moves.find((move) => move.taskId === 'api')!;
    expect(parked.to).toBe('WAITING_DEPENDENCY');
    expect(parked.reason).toBe('Waiting for Define the schema.');
  });

  it('releases a task once everything it waited for is done', () => {
    const plan = conduct([
      task({ id: 'schema', state: 'DONE' }),
      task({ id: 'api', state: 'WAITING_DEPENDENCY', dependencies: ['schema'] }),
    ]);
    expect(plan.moves.map((move) => [move.taskId, move.to])).toEqual([
      ['api', 'READY'],
      ['api', 'QUEUED'],
    ]);
  });

  it('blocks a task nobody is assigned to, and says what to do about it', () => {
    const plan = conduct([task({ id: 'a', assignedAgentId: undefined })]);
    expect(plan.moves[0]!.to).toBe('BLOCKED');
    expect(plan.moves[0]!.reason).toContain('Put someone on the project');
  });

  it('unblocks a task as soon as it has an agent', () => {
    const plan = conduct([task({ id: 'a', state: 'BLOCKED' })]);
    expect(plan.moves.map((move) => move.to)).toEqual(['READY', 'QUEUED']);
  });

  it('will not start work the remaining budget cannot pay for', () => {
    const plan = conduct([task({ id: 'a', estimatedCost: 12 })], { remainingBudget: 5 });
    expect(plan.moves[0]!.to).toBe('WAITING_BUDGET_APPROVAL');
    expect(plan.moves[0]!.reason).toContain('does not cover');
  });

  it('spends the budget once across a whole pass', () => {
    // Each task fits on its own; together they do not. Checking them one by one
    // against the same headroom would start both and overspend.
    const plan = conduct(
      [task({ id: 'a', estimatedCost: 3 }), task({ id: 'b', estimatedCost: 3 })],
      {
        remainingBudget: 4,
      },
    );
    expect(plan.moves.map((move) => [move.taskId, move.to])).toEqual([
      ['a', 'QUEUED'],
      ['b', 'WAITING_BUDGET_APPROVAL'],
    ]);
  });

  it('does not start two tasks writing the same paths', () => {
    const plan = conduct([
      task({ id: 'a', writeScope: ['apps/web'] }),
      task({ id: 'b', writeScope: ['apps/web/app'] }),
    ]);
    expect(plan.moves.map((move) => [move.taskId, move.to])).toEqual([['a', 'QUEUED']]);
    expect(plan.holds[0]!.reason).toContain('already writing apps/web');
  });

  it('turns a draft into ready work and starts it in the same pass', () => {
    const plan = conduct([task({ id: 'a', state: 'DRAFT' })]);
    expect(plan.moves.map((move) => move.to)).toEqual(['READY', 'QUEUED']);
  });

  it('sends work the reviewer rejected back into the queue', () => {
    const plan = conduct([task({ id: 'a', state: 'FIX_REQUIRED' })]);
    expect(plan.moves.map((move) => move.to)).toEqual(['READY', 'QUEUED']);
  });

  it('stops at ready in a supervised project and says whose turn it is', () => {
    const plan = conduct([task({ id: 'a' })], { autonomyMode: 'SUPERVISED' });
    expect(plan.moves).toEqual([]);
    expect(plan.holds[0]!.reason).toContain('supervised mode');
  });

  it('changes nothing on a second pass', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b', dependencies: ['a'] })];
    const first = conduct(tasks);
    const settled = tasks.map((entry) => {
      const moved = [...first.moves].reverse().find((move) => move.taskId === entry.id);
      return moved ? { ...entry, state: moved.to } : entry;
    });
    expect(conduct(settled).moves).toEqual([]);
  });

  it('leaves finished and cancelled work alone', () => {
    const plan = conduct([
      task({ id: 'a', state: 'DONE' }),
      task({ id: 'b', state: 'CANCELED' }),
      task({ id: 'c', state: 'FAILED_FINAL' }),
    ]);
    expect(plan.moves).toEqual([]);
    expect(plan.holds).toEqual([]);
  });
});
