import {
  AsyncOutboxDispatcher,
  DEFAULT_PG_BOSS_QUEUE,
  PgBossQueue,
  type QueueJob,
  type PgBossClient,
} from '@bunker-studio/orchestration';
import { startPgBoss } from './pg-boss';
import { WorkerLoop, type WorkerQueue } from './runner';

type QueueHandler = (job: QueueJob) => Promise<void> | void;

export function createPersistentWorker(input: {
  boss: PgBossClient;
  outbox: ConstructorParameters<typeof AsyncOutboxDispatcher>[0];
  handlers: Record<string, QueueHandler>;
  queueName?: string;
}): { worker: WorkerLoop; dispatcher: AsyncOutboxDispatcher } {
  const queue = new PgBossQueue(input.boss, input.queueName);
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

export async function startPersistentWorker(input: {
  connectionString: string;
  outbox: ConstructorParameters<typeof AsyncOutboxDispatcher>[0];
  handlers: Record<string, QueueHandler>;
  queueName?: string;
  pollIntervalMs?: number;
  onError?: (error: unknown) => void;
}): Promise<{
  worker: WorkerLoop;
  dispatcher: AsyncOutboxDispatcher;
  stop: () => Promise<void>;
}> {
  const queueName = input.queueName ?? DEFAULT_PG_BOSS_QUEUE;
  const started = await startPgBoss(input.connectionString, queueName);
  const composed = createPersistentWorker({
    boss: started.client,
    outbox: input.outbox,
    handlers: input.handlers,
    queueName,
  });
  const pollIntervalMs = input.pollIntervalMs ?? 1_000;
  const onError = input.onError ?? ((error) => console.error('Persistent worker error', error));
  const dispatch = () => {
    void composed.dispatcher.dispatchOne().catch(onError);
  };
  dispatch();
  const dispatcherTimer = setInterval(dispatch, pollIntervalMs);
  composed.worker.start();
  return {
    ...composed,
    stop: async () => {
      clearInterval(dispatcherTimer);
      composed.worker.stop();
      await started.stop();
    },
  };
}
