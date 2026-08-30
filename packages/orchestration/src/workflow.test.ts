import { describe, expect, it } from 'vitest';
import { DurableQueue } from './queue';
import { WorkflowRunner, type WorkflowTask } from './workflow';

describe('workflow runner', () => {
  it('runs a dependency DAG without user continuation', async () => {
    const order: string[] = [];
    const tasks: WorkflowTask[] = [
      {
        id: 'backend',
        title: 'Backend',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['api'],
        estimatedCost: 1,
        payload: {},
      },
      {
        id: 'frontend',
        title: 'Frontend',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['web'],
        estimatedCost: 1,
        payload: {},
      },
      {
        id: 'verify',
        title: 'Verify',
        state: 'DRAFT',
        dependencies: ['backend', 'frontend'],
        writeScope: [],
        estimatedCost: 1,
        payload: {},
      },
    ];
    const result = await new WorkflowRunner(new DurableQueue(), (task) => {
      order.push(task.id);
    }).run(tasks, 3);
    expect(result.executedTaskIds).toEqual(['backend', 'frontend', 'verify']);
    expect(order).toEqual(['backend', 'frontend', 'verify']);
    expect(result.tasks.every((task) => task.state === 'DONE')).toBe(true);
  });

  it('blocks tasks that exceed the remaining hard budget before invocation', async () => {
    let invoked = false;
    const task: WorkflowTask = {
      id: 'expensive',
      title: 'Expensive',
      state: 'DRAFT',
      dependencies: [],
      writeScope: [],
      estimatedCost: 10,
      payload: {},
    };
    const result = await new WorkflowRunner(new DurableQueue(), () => {
      invoked = true;
    }).run([task], 1);
    expect(invoked).toBe(false);
    expect(result.blockedTaskIds).toEqual(['expensive']);
    expect(result.tasks[0]?.state).toBe('READY');
  });

  it('never queues a parallel batch above the remaining hard budget', async () => {
    const invoked: string[] = [];
    const tasks: WorkflowTask[] = [
      {
        id: 'first',
        title: 'First',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['one'],
        estimatedCost: 2,
        payload: {},
      },
      {
        id: 'second',
        title: 'Second',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['two'],
        estimatedCost: 2,
        payload: {},
      },
    ];
    const result = await new WorkflowRunner(new DurableQueue(), (task) => {
      invoked.push(task.id);
    }).run(tasks, 2);
    expect(invoked).toEqual(['first']);
    expect(result.tasks.find((task) => task.id === 'second')?.state).toBe('READY');
    expect(result.blockedTaskIds).toEqual(['second']);
  });

  it('runs disjoint tasks concurrently and serializes overlapping scopes', async () => {
    let active = 0;
    let maximumActive = 0;
    const activeTaskIds = new Set<string>();
    let sharedOverlapped = false;
    const tasks: WorkflowTask[] = [
      {
        id: 'frontend',
        title: 'Frontend',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['src/ui'],
        estimatedCost: 1,
        payload: {},
      },
      {
        id: 'backend',
        title: 'Backend',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['src/api'],
        estimatedCost: 1,
        payload: {},
      },
      {
        id: 'shared',
        title: 'Shared',
        state: 'DRAFT',
        dependencies: [],
        writeScope: ['src'],
        estimatedCost: 1,
        payload: {},
      },
    ];
    const result = await new WorkflowRunner(new DurableQueue(), async (task) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      activeTaskIds.add(task.id);
      if (task.id === 'shared' && activeTaskIds.size > 1) sharedOverlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeTaskIds.delete(task.id);
      active -= 1;
    }).run(tasks, 3);

    expect(maximumActive).toBe(2);
    expect(sharedOverlapped).toBe(false);
    expect(result.executedTaskIds).toEqual(['frontend', 'backend', 'shared']);
    expect(result.tasks.every((task) => task.state === 'DONE')).toBe(true);
  });
});
