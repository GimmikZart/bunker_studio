import { workerLeaseRenewalSchema } from '@bunker-studio/contracts';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createWorkerServiceSupabaseClient } from '../../../../_supabase';

function bearerCredential(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

export async function POST(request: Request) {
  const client = createWorkerServiceSupabaseClient();
  if (!client)
    return NextResponse.json(
      { error: 'Worker service persistence is not configured.' },
      { status: 503 },
    );
  const credential = bearerCredential(request);
  if (!credential)
    return NextResponse.json({ error: 'Worker credential is required.' }, { status: 401 });
  try {
    const input = workerLeaseRenewalSchema.parse(await request.json());
    const { data, error } = await client.rpc('renew_local_worker_lease', {
      p_lease_id: input.leaseId,
      p_node_id: input.nodeId,
      p_credential_hash: createHash('sha256').update(credential).digest('hex'),
      p_lease_seconds: 120,
    });
    if (error) return NextResponse.json({ error: 'Worker lease renewal failed.' }, { status: 503 });
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row || row.authenticated !== true)
      return NextResponse.json(
        { error: 'Worker credential is invalid or revoked.' },
        { status: 401 },
      );
    if (row.renewed !== true || typeof row.lease_expires_at !== 'string')
      return NextResponse.json({ error: 'Worker lease is no longer active.' }, { status: 409 });
    return NextResponse.json({ leaseExpiresAt: row.lease_expires_at });
  } catch {
    return NextResponse.json({ error: 'Invalid worker lease renewal request.' }, { status: 400 });
  }
}
