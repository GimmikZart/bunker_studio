import { authCredentialsSchema } from '@bunker-studio/contracts';
import { createStudioAuthClient } from '@bunker-studio/db';
import { NextResponse } from 'next/server';
import { authEnvironment } from '../_config';

export async function POST(request: Request) {
  const environment = authEnvironment();
  if (!environment)
    return NextResponse.json({ error: 'Supabase Auth is not configured.' }, { status: 503 });
  try {
    const credentials = authCredentialsSchema.parse(await request.json());
    const { data, error } = await createStudioAuthClient(environment).auth.signUp(credentials);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(
      { user: data.user, sessionCreated: Boolean(data.session) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 });
  }
}
