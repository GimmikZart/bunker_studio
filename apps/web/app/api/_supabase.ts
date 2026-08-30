import { createStudioSupabaseClient } from '@bunker-studio/db';
import { cookies } from 'next/headers';

export async function createRequestSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return createStudioSupabaseClient(
    {
      getAll: () => cookieStore.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
    { url, anonKey },
  );
}
