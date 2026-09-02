import { describe, expect, it } from 'vitest';
import {
  exportOrganization,
  importOrganization,
  isWorkerEligible,
  registerWorker,
  WorkerRegistry,
  WorkerTaskScheduler,
} from './index';

describe('worker and portability foundations', () => {
  it('does not schedule an offline worker', () => {
    const node = registerWorker('local', ['text'], 1_000);
    expect(isWorkerEligible(node, 1_001)).toBe(true);
    expect(isWorkerEligible({ ...node, status: 'OFFLINE' }, 1_001)).toBe(false);
  });

  it('projects a stale heartbeat as offline in the worker monitor', () => {
    const registry = new WorkerRegistry();
    registry.register({
      organizationId: 'org-1',
      name: 'Stale PC',
      capabilities: ['chat'],
      now: 1_000,
    });
    expect(registry.list('org-1', 181_001)).toMatchObject([{ status: 'OFFLINE' }]);
  });

  it('exports no plaintext provider secret and remaps tenant identity on import', () => {
    const pack = exportOrganization({
      organization: { id: 'org-1', name: 'Org' },
      teams: [{ id: 'team-1', name: 'Team' }],
      projects: [],
      agents: [],
      memories: [],
      conversations: [],
      providerConnections: [{ id: 'provider-1', encryptedSecretBlob: 'ciphertext' }],
    });
    expect(pack.providerConnections).toEqual([{ id: 'provider-1', status: 'REQUIRES_REAUTH' }]);
    const imported = importOrganization(pack);
    expect(imported.organizationId).not.toBe('org-1');
    expect(imported.idMap.has('team-1')).toBe(true);
  });

  it('assigns only eligible workers with capability, scope and concurrency capacity', () => {
    const registry = new WorkerRegistry();
    const worker = registry.register({
      organizationId: 'org-1',
      name: 'Ollama',
      capabilities: ['ollama'],
      allowedScopes: ['apps/web'],
      maxConcurrent: 1,
      now: 1_000,
    });
    const scheduler = new WorkerTaskScheduler(registry);
    const assignment = scheduler.assign(
      {
        id: 'task-1',
        organizationId: 'org-1',
        capability: 'ollama',
        readScope: ['apps/web/config'],
        writeScope: ['apps/web/src'],
      },
      1_001,
    );
    expect(assignment).toMatchObject({ taskId: 'task-1', workerId: worker.id });
    expect(
      scheduler.assign(
        { id: 'task-2', organizationId: 'org-1', capability: 'ollama', writeScope: ['apps/web'] },
        1_002,
      ),
    ).toBeNull();
    scheduler.finish(assignment!);
    expect(
      scheduler.assign(
        {
          id: 'task-bad-scope',
          organizationId: 'org-1',
          capability: 'ollama',
          writeScope: ['packages/db'],
        },
        1_002,
      ),
    ).toBeNull();
    registry.setOffline(worker.id);
    expect(
      scheduler.assign(
        { id: 'task-3', organizationId: 'org-1', capability: 'ollama', writeScope: ['apps/web'] },
        1_003,
      ),
    ).toBeNull();
  });
});
