import { describe, expect, it } from 'vitest';
import { approveDesignVersion, confirmStaffingProposal, suggestStaffingTeam } from './index';

describe('design and HR gates', () => {
  it('keeps exactly the approved design version current', () => {
    const versions = [
      { id: 'v1', version: 1, status: 'APPROVED' as const, spec: {} },
      { id: 'v2', version: 2, status: 'SUBMITTED' as const, spec: {} },
    ];
    const result = approveDesignVersion(versions, 'v2', 'owner');
    expect(result.find((version) => version.id === 'v2')?.status).toBe('APPROVED');
    expect(result.find((version) => version.id === 'v1')?.status).toBe('SUPERSEDED');
  });

  it('does not persist recommended agents until explicit confirmation', () => {
    expect(confirmStaffingProposal(false, 3)).toEqual({ persistAgents: false, count: 0 });
    expect(confirmStaffingProposal(true, 3)).toEqual({ persistAgents: true, count: 3 });
    expect(suggestStaffingTeam({ requiredRoles: ['frontend'], budget: 2 })).toHaveLength(1);
    expect(suggestStaffingTeam({ requiredRoles: ['lead'], budget: 1 })).toHaveLength(0);
  });
});
