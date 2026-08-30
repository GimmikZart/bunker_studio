import { authCredentialsSchema } from '@bunker-studio/contracts';
import { createStudioSupabaseClient } from '@bunker-studio/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authEnvironment } from '../_config';

export async function POST(request: Request) {
  const environment = authEnvironment();
  if (!environment)
    return NextResponse.json({ error: 'Supabase Auth is not configured.' }, { status: 503 });
  try {
    const credentials = authCredentialsSchema.parse(await request.json());
    const cookieStore = await cookies();
    const client = createStudioSupabaseClient(
      {
        getAll: () => cookieStore.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
      environment,
    );
    const { data, error } = await client.auth.signInWithPassword(credentials);
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 });
  }
}
