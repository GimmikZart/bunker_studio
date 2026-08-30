import { createRequestSupabaseClient } from './_supabase';

export async function resolveActorId(request: Request): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production') {
    const fixtureId = request.headers.get('x-bunker-user-id')?.trim();
    if (fixtureId) return fixtureId;
  }
  const client = await createRequestSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}
