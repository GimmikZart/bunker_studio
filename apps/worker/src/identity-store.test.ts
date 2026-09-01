import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkerIdentity, saveWorkerIdentity } from './identity-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('worker identity store', () => {
  it('persists the exchanged credential without requiring the one-time token again', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bunker-worker-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'nested', 'identity.json');
    const identity = { nodeId: 'node-id', credential: 'worker-secret' };
    await saveWorkerIdentity(identity, path);
    await expect(loadWorkerIdentity(path)).resolves.toEqual(identity);
    expect(await readFile(path, 'utf8')).not.toContain('registration');
  });

  it('returns null before the worker has registered', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bunker-worker-'));
    temporaryDirectories.push(directory);
    await expect(loadWorkerIdentity(join(directory, 'missing.json'))).resolves.toBeNull();
  });
});
