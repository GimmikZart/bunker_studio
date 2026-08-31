import { workerHeartbeatSchema } from '@bunker-studio/contracts';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createWorkerServiceSupabaseClient } from '../../../../_supabase';

function bearerCredential(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

function taskPayload(row: Record<string, unknown>) {
  return {
    leaseId: row.lease_id,
    taskId: row.task_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    state: row.task_state,
    readScope: row.read_scope_json,
    writeScope: row.write_scope_json,
    definitionOfDone: row.definition_of_done_json,
    requiredCapability: row.required_capability,
    attemptNumber: row.attempt_number,
    leaseExpiresAt: row.lease_expires_at,
  };
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
    const { nodeId } = workerHeartbeatSchema.parse(await request.json());
    const { data, error } = await client.rpc('claim_local_worker_task', {
      p_node_id: nodeId,
      p_credential_hash: createHash('sha256').update(credential).digest('hex'),
      p_lease_seconds: 120,
    });
    if (error) return NextResponse.json({ error: 'Worker task claim failed.' }, { status: 503 });
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row || row.authenticated !== true)
      return NextResponse.json(
        { error: 'Worker credential is invalid or revoked.' },
        { status: 401 },
      );
    return NextResponse.json({ task: typeof row.task_id === 'string' ? taskPayload(row) : null });
  } catch {
    return NextResponse.json({ error: 'Invalid worker task claim request.' }, { status: 400 });
  }
}
