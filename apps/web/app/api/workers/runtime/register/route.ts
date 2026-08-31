import { workerRuntimeRegistrationSchema } from '@bunker-studio/contracts';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createWorkerServiceSupabaseClient } from '../../../_supabase';

function workerPayload(value: Record<string, unknown>) {
  const capabilities = value.capabilities_json;
  const scopes = value.allowed_scopes_json;
  const items = (input: unknown) =>
    input && typeof input === 'object' && Array.isArray((input as { items?: unknown }).items)
      ? (input as { items: unknown[] }).items.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
  return {
    id: value.node_id,
    organizationId: value.organization_id,
    name: value.name,
    status: 'ONLINE',
    capabilities: items(capabilities),
    allowedScopes: items(scopes),
    maxConcurrent: value.max_concurrent,
    activeJobs: 0,
    lastHeartbeatAt: Date.now(),
    heartbeatIntervalMs: 60_000,
  };
}

export async function POST(request: Request) {
  const client = createWorkerServiceSupabaseClient();
  if (!client)
    return NextResponse.json(
      { error: 'Worker service persistence is not configured.' },
      { status: 503 },
    );
  try {
    const input = workerRuntimeRegistrationSchema.parse(await request.json());
    const { data, error } = await client.rpc('exchange_worker_registration_token', {
      p_token_hash: createHash('sha256').update(input.registrationToken).digest('hex'),
      p_name: input.name,
      p_capabilities: input.capabilities,
    });
    if (error || !Array.isArray(data) || !data[0])
      return NextResponse.json(
        { error: 'Worker registration token is invalid or expired.' },
        { status: 401 },
      );
    const row = data[0] as Record<string, unknown>;
    return NextResponse.json(
      { worker: workerPayload(row), credential: row.credential },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid worker registration request.' }, { status: 400 });
  }
}
