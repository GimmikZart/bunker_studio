import { workerHeartbeatSchema } from '@bunker-studio/contracts';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createWorkerServiceSupabaseClient } from '../../../_supabase';

export async function POST(request: Request) {
  const client = createWorkerServiceSupabaseClient();
  if (!client)
    return NextResponse.json(
      { error: 'Worker service persistence is not configured.' },
      { status: 503 },
    );
  const authorization = request.headers.get('authorization') ?? '';
  const credential = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!credential)
    return NextResponse.json({ error: 'Worker credential is required.' }, { status: 401 });
  try {
    const { nodeId } = workerHeartbeatSchema.parse(await request.json());
    const { data, error } = await client.rpc('heartbeat_local_worker', {
      p_node_id: nodeId,
      p_credential_hash: createHash('sha256').update(credential).digest('hex'),
    });
    if (error || !Array.isArray(data) || !data[0])
      return NextResponse.json(
        { error: 'Worker credential is invalid or revoked.' },
        { status: 401 },
      );
    return NextResponse.json({ worker: data[0] });
  } catch {
    return NextResponse.json({ error: 'Invalid worker heartbeat request.' }, { status: 400 });
  }
}
