import { spawn } from 'node:child_process';
import { startPgBoss } from './pg-boss.js';

const smokeMode = process.env.BUNKER_PG_BOSS_SMOKE_MODE?.trim();
const databaseUrl =
  process.env.BUNKER_PG_BOSS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
let queueName = process.env.BUNKER_PG_BOSS_SMOKE_QUEUE?.trim();

type ClaimResult = { id: string | null; label: string };

function requireDatabaseUrl(): string {
  if (!databaseUrl)
    throw new Error(
      'Set BUNKER_PG_BOSS_DATABASE_URL (or DATABASE_URL) before running the pg-boss restart smoke.',
    );
  return databaseUrl;
}

function requireSmokeConfig(): { databaseUrl: string; queueName: string } {
  const connectionString = requireDatabaseUrl();
  if (!queueName) throw new Error('The smoke queue name is required.');
  return { databaseUrl: connectionString, queueName };
}

async function claimInChild(label: string): Promise<ClaimResult> {
  const { databaseUrl: connectionString, queueName: name } = requireSmokeConfig();
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, '--claim-child'], {
    env: {
      ...process.env,
      BUNKER_PG_BOSS_SMOKE_MODE: 'claim-child',
      BUNKER_PG_BOSS_DATABASE_URL: connectionString,
      BUNKER_PG_BOSS_SMOKE_QUEUE: name,
      BUNKER_PG_BOSS_SMOKE_LABEL: label,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    errors += chunk.toString();
  });

  return await new Promise<ClaimResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`pg-boss claim child timed out (${label}).`));
    }, 120_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      const resultLine = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith('PG_BOSS_SMOKE_RESULT '));
      if (code !== 0 || !resultLine) {
        reject(
          new Error(
            `pg-boss claim child failed (${label}, code=${code ?? 'null'}, signal=${signal ?? 'none'}): ${errors.trim()}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(resultLine.slice('PG_BOSS_SMOKE_RESULT '.length)) as ClaimResult);
      } catch {
        reject(new Error(`pg-boss claim child returned invalid output (${label}).`));
      }
    });
  });
}

async function claimChild(): Promise<void> {
  const { databaseUrl: connectionString, queueName: name } = requireSmokeConfig();
  const started = await startPgBoss(connectionString, name);
  try {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const fetched = await started.client.fetch(name, { batchSize: 1, expireInSeconds: 1 });
      const job = Array.isArray(fetched) ? (fetched[0] ?? null) : fetched;
      if (job) {
        console.log(
          `PG_BOSS_SMOKE_RESULT ${JSON.stringify({
            id: job.id,
            label: process.env.BUNKER_PG_BOSS_SMOKE_LABEL ?? 'unknown',
          })}`,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error('pg-boss did not reclaim the smoke job before the deadline.');
  } finally {
    await started.stop();
  }
}

async function runSmoke(): Promise<void> {
  const connectionString = requireDatabaseUrl();
  const name = `bunker-studio.quality.restart.${Date.now()}`;
  const operationKey = `quality-restart-${Date.now()}`;
  process.env.BUNKER_PG_BOSS_SMOKE_QUEUE = name;
  queueName = name;
  const started = await startPgBoss(connectionString, name);
  try {
    const jobId = await started.client.send(
      name,
      {
        operationKey,
        type: 'quality.restart',
        payload: { marker: 'restart-safe' },
        availableAt: Date.now(),
      },
      {
        singletonKey: operationKey,
        singletonSeconds: 3600,
        expireInSeconds: 1,
        startAfter: new Date(),
      },
    );
    if (!jobId) throw new Error('pg-boss did not return a smoke job id.');
  } finally {
    await started.stop();
  }

  const first = await claimInChild('first-process');
  if (!first.id) throw new Error('The first process did not claim the smoke job.');
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  const second = await claimInChild('restarted-process');
  if (second.id !== first.id)
    throw new Error(`Restarted process claimed ${second.id ?? 'no job'} instead of ${first.id}.`);

  const cleanup = await startPgBoss(connectionString, name);
  try {
    await cleanup.client.complete(name, second.id);
  } finally {
    await cleanup.stop();
  }
  console.log(JSON.stringify({ event: 'pg_boss_restart_smoke', status: 'PASS', jobId: second.id }));
}

if (smokeMode === 'claim-child') await claimChild();
else await runSmoke();
