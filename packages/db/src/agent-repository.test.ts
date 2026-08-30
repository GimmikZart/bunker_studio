import { describe, expect, it } from 'vitest';
import { SupabaseAgentRepository } from './agent-repository';
import type { QueryResult, SupabaseDataClient } from './tenant-repository';

function fakeClient(data: unknown): SupabaseDataClient {
  const memberResult: QueryResult = { data: { role: 'OWNER' }, error: null };
  const agentResult: QueryResult = { data, error: null };
  let currentResult = memberResult;
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    update: () => query,
    insert: () => ({ select: () => query }),
    maybeSingle: async () => currentResult,
    single: async () => currentResult,
    then: (onFulfilled: (value: typeof currentResult) => unknown) =>
      Promise.resolve(currentResult).then(onFulfilled),
  };
  return {
    from: (table: string) => {
      currentResult = table === 'organization_members' ? memberResult : agentResult;
      return query;
    },
    rpc: async () => agentResult,
  } as unknown as SupabaseDataClient;
}

describe('Supabase agent repository', () => {
  it('preserves identity and exposes the active binding', async () => {
    const repository = new SupabaseAgentRepository(
      fakeClient([
        {
          id: 'agent-1',
          organization_id: 'org-1',
          name: 'Lead',
          role_key: 'lead',
          title: 'Lead',
          personality_json: { tone: 'calm' },
          archived_at: null,
          agent_bindings: [{ id: 'binding-1', active_to: null }],
        },
      ]),
    );
    await expect(repository.listAgents('org-1', 'user-1')).resolves.toMatchObject([
      { id: 'agent-1', providerBindingId: 'binding-1', personality: { tone: 'calm' } },
    ]);
  });
});
