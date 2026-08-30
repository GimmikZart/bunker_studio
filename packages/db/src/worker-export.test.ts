import { describe, expect, it } from 'vitest';
import { exportOrganization, importOrganization, isWorkerEligible, registerWorker } from './index';

describe('worker and portability foundations', () => {
  it('does not schedule an offline worker', () => {
    const node = registerWorker('local', ['text'], 1_000);
    expect(isWorkerEligible(node, 1_001)).toBe(true);
    expect(isWorkerEligible({ ...node, status: 'OFFLINE' }, 1_001)).toBe(false);
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
});
