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
});
