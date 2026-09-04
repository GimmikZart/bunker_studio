import { createStudioSupabaseClient } from '@bunker-studio/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authEnvironment } from '../_config';

export async function GET() {
  const environment = authEnvironment();
  // "Who am I?" is a question, not a protected action: when cloud auth is not
  // configured the honest answer is "nobody, and there is nothing to sign in
  // to". Answering 503 made every page log a console error in local
  // development. Sign-up and sign-in still fail closed.
  if (!environment) return NextResponse.json({ user: null, authConfigured: false });
  const cookieStore = await cookies();
  const client = createStudioSupabaseClient(
    {
      getAll: () => cookieStore.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
    environment,
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return NextResponse.json({ user: null, authConfigured: true }, { status: 401 });
  return NextResponse.json({ user: data.user, authConfigured: true });
}
