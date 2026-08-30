import { DurableQueue, type QueueJob } from './queue.js';
import {
  canTransition,
  eligibleTasks,
  transitionTask,
  type TaskDefinition,
  type TaskState,
} from './index.js';

export type WorkflowTask = TaskDefinition & {
  title: string;
  payload: Record<string, unknown>;
};

export type WorkflowRunResult = {
  tasks: WorkflowTask[];
  executedTaskIds: string[];
  blockedTaskIds: string[];
};

export type WorkflowTaskHandler = (task: WorkflowTask, job: QueueJob) => Promise<void> | void;

function move(task: WorkflowTask, state: TaskState): WorkflowTask {
  return { ...task, ...transitionTask(task, state) };
}

/**
 * Deterministic scheduler for the worker contract. Persistence is supplied by
 * the queue implementation; the state transitions remain pure and auditable.
 */
export class WorkflowRunner {
  constructor(
    private readonly queue: DurableQueue,
    private readonly handler: WorkflowTaskHandler,
  ) {}

  async run(tasks: WorkflowTask[], remainingBudget: number): Promise<WorkflowRunResult> {
    const state = tasks.map((task) => ({ ...task }));
    const executedTaskIds: string[] = [];
    const blockedTaskIds: string[] = [];

    for (const task of state) {
      if (task.state !== 'DRAFT') continue;
      task.state = task.dependencies.length ? 'WAITING_DEPENDENCY' : 'READY';
    }

    while (true) {
      for (const task of state) {
        if (
          task.state === 'WAITING_DEPENDENCY' &&
          task.dependencies.every((id) => state.find((item) => item.id === id)?.state === 'DONE')
        ) {
          task.state = 'READY';
        }
      }

      let batchBudget = 0;
      const eligible = eligibleTasks(state, remainingBudget)
        .filter((candidate) => {
          if (batchBudget + candidate.estimatedCost > remainingBudget) return false;
          batchBudget += candidate.estimatedCost;
          return true;
        })
        .map((candidate) => state.find((task) => task.id === candidate.id))
        .filter((task): task is WorkflowTask => Boolean(task));
      for (const task of eligible) {
        task.state = move(task, 'QUEUED').state;
        this.queue.enqueue({
          operationKey: `workflow:${task.id}`,
          type: 'workflow.task',
          payload: { taskId: task.id },
          availableAt: 0,
        });
      }

      const job = this.queue.claim(0);
      if (!job) break;
      const taskId = String(job.payload.taskId);
      const task = state.find((candidate) => candidate.id === taskId);
      if (!task) throw new Error(`Task ${taskId} is not part of this workflow.`);

      task.state = move(task, 'RUNNING').state;
      try {
        await this.handler(task, job);
        task.state = move(task, 'IMPLEMENTED').state;
        task.state = move(task, 'VERIFYING').state;
        task.state = move(task, 'DONE').state;
        remainingBudget -= task.estimatedCost;
        executedTaskIds.push(task.id);
        this.queue.complete(job.id);
      } catch {
        task.state = canTransition(task.state, 'FAILED_RETRYABLE')
          ? move(task, 'FAILED_RETRYABLE').state
          : 'FAILED_FINAL';
        blockedTaskIds.push(task.id);
        this.queue.complete(job.id);
      }
    }

    for (const task of state) {
      if (
        !['DONE', 'FAILED_FINAL', 'CANCELED'].includes(task.state) &&
        !blockedTaskIds.includes(task.id)
      ) {
        blockedTaskIds.push(task.id);
      }
    }
    return { tasks: state, executedTaskIds, blockedTaskIds };
  }
}
