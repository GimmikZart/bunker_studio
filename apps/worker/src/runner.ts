import type { QueueJob } from '@bunker-studio/orchestration';

type Awaitable<T> = T | Promise<T>;

export type WorkerQueue = {
  claim: () => Awaitable<QueueJob | null>;
  complete: (jobId: string) => Awaitable<void>;
  release?: (job: QueueJob, availableAt: number, error?: string) => Awaitable<void>;
};

export type JobHandler = (job: QueueJob) => Awaitable<void>;

export type WorkerRunStatus = 'IDLE' | 'COMPLETED' | 'RETRY_SCHEDULED' | 'FAILED';

export class WorkerLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly queue: WorkerQueue,
    private readonly handlers: Record<string, JobHandler>,
    private readonly options: { pollIntervalMs?: number; retryDelayMs?: number } = {},
  ) {}

  async runOnce(): Promise<WorkerRunStatus> {
    if (this.running) return 'IDLE';
    this.running = true;
    try {
      const job = await this.queue.claim();
      if (!job) return 'IDLE';
      const handler = this.handlers[job.type];
      if (!handler) throw new Error(`No handler registered for ${job.type}.`);
      try {
        await handler(job);
        await this.queue.complete(job.id);
        return 'COMPLETED';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (this.queue.release) {
          await this.queue.release(job, Date.now() + (this.options.retryDelayMs ?? 5_000), message);
          return 'RETRY_SCHEDULED';
        }
        return 'FAILED';
      }
    } finally {
      this.running = false;
    }
  }

  start(): void {
    if (this.timer) return;
    const intervalMs = this.options.pollIntervalMs ?? 1_000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
