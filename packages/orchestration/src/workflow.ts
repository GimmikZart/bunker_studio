import { DurableQueue, type QueueJob } from './queue.js';
import {
  canTransition,
  eligibleTasks,
  groupParallelTasks,
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
    private readonly options: { maxParallelism?: number } = {},
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

      const maxParallelism = Math.max(1, this.options.maxParallelism ?? 2);
      const safeGroups = groupParallelTasks(eligibleTasks(state, remainingBudget), maxParallelism);
      const eligible: WorkflowTask[] = [];
      let batchBudget = 0;
      for (const group of safeGroups) {
        for (const candidate of group) {
          if (batchBudget + candidate.estimatedCost > remainingBudget) continue;
          const task = state.find((item) => item.id === candidate.id);
          if (!task) continue;
          eligible.push(task);
          batchBudget += candidate.estimatedCost;
        }
        if (eligible.length) break;
      }
      for (const task of eligible) {
        task.state = move(task, 'QUEUED').state;
        this.queue.enqueue({
          operationKey: `workflow:${task.id}`,
          type: 'workflow.task',
          payload: { taskId: task.id },
          availableAt: 0,
        });
      }

      const claimed = eligible
        .map((task) => {
          const job = this.queue.claim(0);
          return job ? { task, job } : null;
        })
        .filter((entry): entry is { task: WorkflowTask; job: QueueJob } => Boolean(entry));
      if (!claimed.length) break;
      claimed.forEach(({ task }) => {
        task.state = move(task, 'RUNNING').state;
      });
      const results = await Promise.all(
        claimed.map(async ({ task, job }) => {
          try {
            await this.handler(task, job);
            task.state = move(task, 'IMPLEMENTED').state;
            task.state = move(task, 'VERIFYING').state;
            task.state = move(task, 'REVIEW_PENDING').state;
            task.state = move(task, 'DONE').state;
            this.queue.complete(job.id);
            return { task, completed: true };
          } catch {
            task.state = canTransition(task.state, 'FAILED_RETRYABLE')
              ? move(task, 'FAILED_RETRYABLE').state
              : 'FAILED_FINAL';
            blockedTaskIds.push(task.id);
            this.queue.complete(job.id);
            return { task, completed: false };
          }
        }),
      );
      for (const { task, completed } of results) {
        if (!completed) continue;
        remainingBudget -= task.estimatedCost;
        executedTaskIds.push(task.id);
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
