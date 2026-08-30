import { describe, expect, it } from 'vitest';
import { SupabaseTenancyRepository, type SupabaseDataClient } from './tenant-repository';

function fakeClient(data: unknown): SupabaseDataClient {
  const result = { data, error: null };
  const query = {
    select: () => query,
    eq: () => query,
    insert: () => ({ select: () => query }),
    maybeSingle: async () => result,
    single: async () => result,
    then: (onFulfilled: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return { from: () => query } as unknown as SupabaseDataClient;
}

describe('Supabase tenancy repository', () => {
  it('maps organization rows and keeps the owner role query RLS-aware', async () => {
    const repository = new SupabaseTenancyRepository(
      fakeClient([
        {
          organization: {
            id: 'org-1',
            name: 'Studio',
            slug: 'studio',
            owner_user_id: 'user-1',
            default_autonomy_mode: 'AUTONOMOUS',
            archived_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ]),
    );
    await expect(repository.listOrganizations('user-1')).resolves.toMatchObject([
      { id: 'org-1', ownerUserId: 'user-1' },
    ]);
  });
});
