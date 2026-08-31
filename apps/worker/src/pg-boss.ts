import { PgBoss } from 'pg-boss';
import { DEFAULT_PG_BOSS_QUEUE, type PgBossClient } from '@bunker-studio/orchestration';

export type StartedPgBoss = {
  client: PgBossClient;
  stop: () => Promise<void>;
};

export type PgBossLike = Pick<PgBoss, 'send' | 'fetch' | 'complete' | 'fail'> &
  Partial<Pick<PgBoss, 'deleteJob'>>;

export function createPgBossClient(boss: PgBossLike): PgBossClient {
  return {
    send: (name, data, options) => boss.send(name, data, options),
    fetch: async (name, options) => {
      const jobs = await boss.fetch(name, {
        ...(options ?? {}),
        batchSize: 1,
      });
      return jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data:
          job.data && typeof job.data === 'object' && !Array.isArray(job.data)
            ? (job.data as Record<string, unknown>)
            : {},
      }));
    },
    complete: async (name, id) => {
      await boss.complete(name, id);
    },
    fail: async (name, id, error) => {
      await boss.fail(name, id, error ? { message: error } : undefined);
    },
    deleteJob: async (name, id) => {
      if (boss.deleteJob) await boss.deleteJob(name, id);
    },
  };
}

/**
 * Creates the narrow queue client used by the worker from a real pg-boss
 * instance. Keeping this adapter at the process boundary prevents pg-boss
 * types from leaking into orchestration and keeps tests injectable.
 */
export async function startPgBoss(
  connectionString: string,
  queueName = DEFAULT_PG_BOSS_QUEUE,
): Promise<StartedPgBoss> {
  if (!connectionString.trim()) throw new Error('DATABASE_URL is required for pg-boss.');
  const boss = await new PgBoss(connectionString).start();
  // Keep broker-level retries enabled so a crashed process does not lose an
  // active job. Application failures still use PgBossQueue.release(), which
  // removes the active broker job before enqueueing one explicit retry.
  if (await boss.getQueue(queueName)) await boss.updateQueue(queueName, { retryLimit: 3 });
  else await boss.createQueue(queueName, { retryLimit: 3 });
  return { client: createPgBossClient(boss), stop: () => boss.stop() };
}
