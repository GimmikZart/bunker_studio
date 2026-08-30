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
});
