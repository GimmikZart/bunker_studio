import { createStudioSupabaseClient } from '@bunker-studio/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authEnvironment } from '../_config';

export async function POST() {
  const environment = authEnvironment();
  if (!environment)
    return NextResponse.json({ error: 'Supabase Auth is not configured.' }, { status: 503 });
  const cookieStore = await cookies();
  const client = createStudioSupabaseClient(
    {
      getAll: () => cookieStore.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
    environment,
  );
  const { error } = await client.auth.signOut();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
