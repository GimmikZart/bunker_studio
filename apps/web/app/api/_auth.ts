import { createStudioSupabaseClient } from '@bunker-studio/db';
import { cookies } from 'next/headers';

export async function resolveActorId(request: Request): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production') {
    const fixtureId = request.headers.get('x-bunker-user-id')?.trim();
    if (fixtureId) return fixtureId;
  }
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  const client = createStudioSupabaseClient(
    {
      getAll: () => cookieStore.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
    { url, anonKey },
  );
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}
