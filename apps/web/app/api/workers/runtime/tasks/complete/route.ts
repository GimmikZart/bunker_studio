import { workerTaskCompletionSchema } from '@bunker-studio/contracts';
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
    const input = workerTaskCompletionSchema.parse(await request.json());
    const { data, error } = await client.rpc('complete_local_worker_task', {
      p_lease_id: input.leaseId,
      p_node_id: input.nodeId,
      p_credential_hash: createHash('sha256').update(credential).digest('hex'),
      p_success: input.success,
      p_result: input.result,
      p_error: input.error ?? null,
    });
    if (error)
      return NextResponse.json({ error: 'Worker task completion failed.' }, { status: 503 });
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row || row.authenticated !== true)
      return NextResponse.json(
        { error: 'Worker credential is invalid or revoked.' },
        { status: 401 },
      );
    if (row.completed !== true)
      return NextResponse.json({ error: 'Worker lease is no longer active.' }, { status: 409 });
    return NextResponse.json({
      task: { id: row.task_id, state: row.task_state, retryCount: row.retry_count },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid worker task completion request.' }, { status: 400 });
  }
}
