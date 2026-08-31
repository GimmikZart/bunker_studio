import { workerRegistrationTokenCreateSchema } from '@bunker-studio/contracts';
import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { createRequestSupabaseClient } from '../../_supabase';
import { getWebOperationalRepository } from '../../_data';

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin worker registration is required.' },
      { status: 403 },
    );
  const client = await createRequestSupabaseClient();
  if (!client)
    return NextResponse.json({ error: 'Supabase persistence is required.' }, { status: 503 });
  try {
    const input = workerRegistrationTokenCreateSchema.parse(await request.json());
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString();
    const { data, error } = await client
      .from('worker_registration_tokens')
      .insert({
        organization_id: organizationId,
        token_hash: createHash('sha256').update(token).digest('hex'),
        allowed_scopes_json: { items: input.allowedScopes },
        max_concurrent: input.maxConcurrent,
        expires_at: expiresAt,
        created_by_user_id: actorId,
      })
      .select('id, expires_at')
      .single();
    if (error || !data) throw new Error('Could not persist worker registration token.');
    return NextResponse.json({ token, expiresAt: data.expires_at }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid worker registration token request.' },
      { status: 400 },
    );
  }
}
