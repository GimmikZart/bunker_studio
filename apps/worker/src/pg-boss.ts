import { PgBoss } from 'pg-boss';
import { DEFAULT_PG_BOSS_QUEUE, type PgBossClient } from '@bunker-studio/orchestration';

export type StartedPgBoss = {
  client: PgBossClient;
  stop: () => Promise<void>;
};

export type PgBossLike = Pick<PgBoss, 'send' | 'fetch' | 'complete' | 'fail'>;

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
  if (!(await boss.getQueue(queueName))) await boss.createQueue(queueName);
  return { client: createPgBossClient(boss), stop: () => boss.stop() };
}
