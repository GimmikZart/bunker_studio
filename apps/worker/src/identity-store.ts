import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { RuntimeWorkerIdentity } from './runtime-client.js';

export function workerIdentityPath(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.WORKER_IDENTITY_FILE?.trim() || '.bunker/worker-identity.json');
}

export async function loadWorkerIdentity(
  path = workerIdentityPath(),
): Promise<RuntimeWorkerIdentity | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<RuntimeWorkerIdentity>;
    return typeof parsed.nodeId === 'string' && typeof parsed.credential === 'string'
      ? { nodeId: parsed.nodeId, credential: parsed.credential }
      : null;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return null;
    throw new Error('The worker identity file is unreadable or invalid.');
  }
}

export async function saveWorkerIdentity(
  identity: RuntimeWorkerIdentity,
  path = workerIdentityPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(identity)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600).catch(() => undefined);
}
