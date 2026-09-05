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

/** A client whose reads succeed as the owner but whose insert fails. */
function failingInsertClient(message: string): SupabaseDataClient {
  const readResult = { data: { role: 'OWNER' }, error: null };
  const insertResult = { data: null, error: { message } };
  const insertQuery = {
    select: () => insertQuery,
    eq: () => insertQuery,
    maybeSingle: async () => insertResult,
    single: async () => insertResult,
    then: (onFulfilled: (value: typeof insertResult) => unknown) =>
      Promise.resolve(insertResult).then(onFulfilled),
  };
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    insert: () => ({ select: () => insertQuery }),
    maybeSingle: async () => readResult,
    single: async () => readResult,
    then: (onFulfilled: (value: typeof readResult) => unknown) =>
      Promise.resolve(readResult).then(onFulfilled),
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

  it('reports a duplicate project name as a conflict rather than an unnamed failure', async () => {
    // What PostgREST returns when the (organization_id, slug) unique index is
    // hit. Passing it through as a plain error made the API answer "invalid
    // payload" for a form that was filled in correctly.
    const repository = new SupabaseTenancyRepository(
      failingInsertClient(
        'duplicate key value violates unique constraint "projects_organization_id_slug_key"',
      ),
    );
    await expect(
      repository.createProject({
        organizationId: 'org-1',
        actorUserId: 'user-1',
        name: 'Vrsus App',
      }),
    ).rejects.toMatchObject({
      name: 'ConflictError',
      message: expect.stringContaining('Vrsus App'),
    });
  });
});
