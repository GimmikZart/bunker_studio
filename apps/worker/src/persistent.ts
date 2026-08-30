import {
  AsyncOutboxDispatcher,
  PgBossQueue,
  type QueueJob,
  type PgBossClient,
} from '@bunker-studio/orchestration';
import { WorkerLoop, type WorkerQueue } from './runner';

type QueueHandler = (job: QueueJob) => Promise<void> | void;

export function createPersistentWorker(input: {
  boss: PgBossClient;
  outbox: ConstructorParameters<typeof AsyncOutboxDispatcher>[0];
  handlers: Record<string, QueueHandler>;
}): { worker: WorkerLoop; dispatcher: AsyncOutboxDispatcher } {
  const queue = new PgBossQueue(input.boss);
  const workerQueue: WorkerQueue = {
    claim: () => queue.claim(),
    complete: (jobId) => queue.complete(jobId),
    release: (job, availableAt, error) => queue.release(job, availableAt, error),
  };
  return {
    worker: new WorkerLoop(workerQueue, input.handlers),
    dispatcher: new AsyncOutboxDispatcher(input.outbox, queue),
  };
}
