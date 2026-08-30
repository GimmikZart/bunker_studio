export type QueueJob = {
  id: string;
  operationKey: string;
  type: string;
  payload: Record<string, unknown>;
  availableAt: number;
  processedAt: number | null;
  attempts: number;
  claimedUntil?: number | null;
  lastError?: string | null;
};

export type QueueInput = Omit<QueueJob, 'id' | 'processedAt' | 'attempts'>;

export class DurableQueue {
  private readonly jobs = new Map<string, QueueJob>();
  private readonly leaseMs: number;

  constructor(options: { leaseMs?: number } = {}) {
    this.leaseMs = options.leaseMs ?? 60_000;
  }

  enqueue(input: QueueInput): QueueJob {
    const existing = [...this.jobs.values()].find(
      (job) => job.operationKey === input.operationKey && !job.processedAt,
    );
    if (existing) return structuredClone(existing);
    const job: QueueJob = {
      ...input,
      id: crypto.randomUUID(),
      processedAt: null,
      attempts: 0,
      claimedUntil: null,
      lastError: null,
    };
    this.jobs.set(job.id, job);
    return structuredClone(job);
  }

  claim(now = Date.now()): QueueJob | null {
    const job = [...this.jobs.values()].find(
      (candidate) =>
        !candidate.processedAt &&
        candidate.availableAt <= now &&
        (!candidate.claimedUntil || candidate.claimedUntil <= now),
    );
    if (!job) return null;
    job.attempts += 1;
    job.claimedUntil = now + this.leaseMs;
    return structuredClone(job);
  }

  complete(jobId: string, now = Date.now()): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Queue job not found.');
    job.processedAt = now;
    job.claimedUntil = null;
  }

  release(jobOrId: string | QueueJob, availableAt: number, error?: string): void {
    const jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId.id;
    const queueJob = this.jobs.get(jobId);
    if (!queueJob) throw new Error('Queue job not found.');
    queueJob.availableAt = availableAt;
    queueJob.claimedUntil = null;
    queueJob.lastError = error ?? null;
  }

  pendingCount(): number {
    return [...this.jobs.values()].filter((job) => !job.processedAt).length;
  }
}

/**
 * The narrow part of pg-boss used by the application. Keeping this adapter
 * structural makes orchestration easy to contract-test without a database,
 * while production can pass a real PgBoss instance.
 */
export type PgBossFetchedJob = {
  id: string;
  name: string;
  data: Record<string, unknown>;
};

export type PgBossClient = {
  send: (
    name: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<string | null>;
  fetch: (
    name: string,
    options?: Record<string, unknown>,
  ) => Promise<PgBossFetchedJob | PgBossFetchedJob[] | null>;
  complete: (name: string, id: string) => Promise<void>;
  fail?: (name: string, id: string, error?: string) => Promise<void>;
};

type PgBossPayload = QueueInput & { attempts?: number };

export class PgBossQueue {
  private readonly claimedJobs = new Map<string, QueueJob>();

  constructor(
    private readonly boss: PgBossClient,
    private readonly queueName = 'bunker-studio.tasks',
  ) {}

  async enqueue(input: QueueInput): Promise<QueueJob> {
    const id = await this.boss.send(this.queueName, input, {
      singletonKey: input.operationKey,
      singletonSeconds: 31_536_000,
      startAfter: new Date(input.availableAt),
    });
    if (!id) throw new Error('pg-boss did not return a job id.');
    return {
      ...input,
      id,
      processedAt: null,
      attempts: 0,
      claimedUntil: null,
      lastError: null,
    };
  }

  async claim(options: { priority?: number } = {}): Promise<QueueJob | null> {
    const fetched = await this.boss.fetch(this.queueName, {
      batchSize: 1,
      priority: options.priority,
    });
    const job = Array.isArray(fetched) ? (fetched[0] ?? null) : fetched;
    if (!job) return null;
    const payload = job.data as unknown as PgBossPayload;
    const result = {
      id: job.id,
      operationKey: payload.operationKey,
      type: payload.type,
      payload: payload.payload,
      availableAt: payload.availableAt,
      processedAt: null,
      attempts: (payload.attempts ?? 0) + 1,
      claimedUntil: null,
      lastError: null,
    };
    this.claimedJobs.set(result.id, result);
    return result;
  }

  async complete(jobId: string): Promise<void> {
    await this.boss.complete(this.queueName, jobId);
  }

  async release(jobOrId: string | QueueJob, availableAt: number, error?: string): Promise<void> {
    const job = typeof jobOrId === 'string' ? this.claimedJobs.get(jobOrId) : jobOrId;
    if (!job) throw new Error('pg-boss job is not known to this worker.');
    if (this.boss.fail) await this.boss.fail(this.queueName, job.id, error);
    await this.enqueue({
      operationKey: `${job.operationKey}:retry:${job.attempts}`,
      type: job.type,
      payload: job.payload,
      availableAt,
    });
  }
}

export type OutboxEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  availableAt: number;
  processedAt: number | null;
  attempts: number;
};

export class InMemoryOutbox {
  private readonly events = new Map<string, OutboxEvent>();

  append(input: Omit<OutboxEvent, 'id' | 'processedAt' | 'attempts'>): OutboxEvent {
    const event: OutboxEvent = {
      ...input,
      id: crypto.randomUUID(),
      processedAt: null,
      attempts: 0,
    };
    this.events.set(event.id, event);
    return structuredClone(event);
  }

  claim(now = Date.now()): OutboxEvent | null {
    const event = [...this.events.values()].find(
      (candidate) => !candidate.processedAt && candidate.availableAt <= now,
    );
    if (!event) return null;
    event.attempts += 1;
    return structuredClone(event);
  }

  markProcessed(eventId: string, now = Date.now()): void {
    const event = this.events.get(eventId);
    if (!event) throw new Error('Outbox event not found.');
    event.processedAt = now;
  }

  reschedule(eventId: string, availableAt: number): void {
    const event = this.events.get(eventId);
    if (!event) throw new Error('Outbox event not found.');
    event.availableAt = availableAt;
  }
}

export class OutboxDispatcher {
  constructor(
    private readonly outbox: InMemoryOutbox,
    private readonly queue: Pick<DurableQueue, 'enqueue'>,
  ) {}

  dispatchOne(now = Date.now()): QueueJob | null {
    const event = this.outbox.claim(now);
    if (!event) return null;
    try {
      const job = this.queue.enqueue({
        operationKey: `outbox:${event.id}`,
        type: event.eventType,
        payload: event.payload,
        availableAt: event.availableAt,
      });
      this.outbox.markProcessed(event.id, now);
      return job;
    } catch (error) {
      this.outbox.reschedule(event.id, now + 5_000);
      throw error;
    }
  }
}

export type AsyncOutboxSource = {
  claim: (now?: Date) => Promise<{
    id: string;
    event_type: string;
    payload_json: Record<string, unknown>;
    available_at: string;
  } | null>;
  markProcessed: (eventId: string) => Promise<void>;
};

export class AsyncOutboxDispatcher {
  constructor(
    private readonly outbox: AsyncOutboxSource,
    private readonly queue: Pick<PgBossQueue, 'enqueue'>,
  ) {}

  async dispatchOne(now = new Date()): Promise<QueueJob | null> {
    const event = await this.outbox.claim(now);
    if (!event) return null;
    const job = await this.queue.enqueue({
      operationKey: `outbox:${event.id}`,
      type: event.event_type,
      payload: event.payload_json,
      availableAt: Date.parse(event.available_at),
    });
    await this.outbox.markProcessed(event.id);
    return job;
  }
}
