import { verificationCommandSchema, workerHeartbeatSchema } from '@bunker-studio/contracts';
import { decryptSecret, type EncryptedSecret } from '@bunker-studio/db';
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

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Worker execution context is invalid.');
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Worker ${field} is not configured.`);
  return value;
}

async function executionContext(
  client: NonNullable<ReturnType<typeof createWorkerServiceSupabaseClient>>,
  row: Record<string, unknown>,
) {
  const taskId = string(row.task_id, 'task');
  const organizationId = string(row.organization_id, 'organization');
  const projectId = string(row.project_id, 'project');
  const { data: taskData, error: taskError } = await client
    .from('tasks')
    .select('assigned_agent_id, verification_json')
    .eq('id', taskId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (taskError || !taskData) throw new Error('The claimed task no longer exists.');
  const task = record(taskData);
  const agentId = string(task.assigned_agent_id, 'assigned agent');
  const verification = record(task.verification_json ?? {});
  const verificationCommands = verificationCommandSchema
    .array()
    .max(20)
    .parse(Array.isArray(verification.commands) ? verification.commands : []);
  const [{ data: agentData, error: agentError }, { data: bindingData, error: bindingError }] =
    await Promise.all([
      client
        .from('agents')
        .select(
          'id, name, role_key, title, personality_json, skills_json, tools_json, permissions_json',
        )
        .eq('id', agentId)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .maybeSingle(),
      client
        .from('agent_bindings')
        .select(
          'id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort, version',
        )
        .eq('agent_id', agentId)
        .is('active_to', null)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (agentError || bindingError || !agentData || !bindingData)
    throw new Error('The assigned agent has no active provider binding.');
  const binding = record(bindingData);
  const providerConnectionId = string(binding.provider_connection_id, 'provider connection');
  const [providerResponse, repositoryResponse] = await Promise.all([
    client
      .from('provider_connections')
      .select('id, provider_type, display_name, encrypted_secret_blob, api_base_url, status')
      .eq('id', providerConnectionId)
      .eq('organization_id', organizationId)
      .eq('status', 'READY')
      .maybeSingle(),
    client
      .from('repo_connections')
      .select(
        'id, provider_type, repo_owner, repo_name, default_branch, status, encrypted_auth_blob',
      )
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);
  if (providerResponse.error || !providerResponse.data)
    throw new Error('The assigned provider connection is not ready.');
  const masterKey = process.env.STUDIO_MASTER_KEY;
  if (!masterKey) throw new Error('Provider secret decryption is not configured.');
  const provider = record(providerResponse.data);
  const encryptedSecret = record(provider.encrypted_secret_blob) as EncryptedSecret;
  const repository = repositoryResponse.data ? record(repositoryResponse.data) : null;
  const repositoryCredential =
    repository?.encrypted_auth_blob && typeof repository.encrypted_auth_blob === 'object'
      ? decryptSecret(record(repository.encrypted_auth_blob) as EncryptedSecret, masterKey)
      : null;

  return {
    verificationCommands,
    agent: {
      ...record(agentData),
      id: agentId,
    },
    binding: {
      id: binding.id,
      providerConnectionId,
      providerModelId: string(binding.provider_model_id, 'provider model'),
      runtimeType: string(binding.runtime_type, 'runtime'),
      reasoningEffort: string(binding.reasoning_effort, 'reasoning effort'),
    },
    provider: {
      type: string(provider.provider_type, 'provider type'),
      displayName: string(provider.display_name, 'provider display name'),
      apiBaseUrl: string(provider.api_base_url, 'provider API base URL'),
      apiKey: decryptSecret(encryptedSecret, masterKey),
    },
    repository: repository
      ? {
          providerType: repository.provider_type,
          owner: repository.repo_owner,
          name: repository.repo_name,
          defaultBranch: repository.default_branch,
          status: repository.status,
          credential: repositoryCredential,
        }
      : null,
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
    if (typeof row.task_id !== 'string') return NextResponse.json({ task: null });
    const context = await executionContext(client, row);
    return NextResponse.json({ task: { ...taskPayload(row), ...context } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid worker task claim request.' },
      { status: 400 },
    );
  }
}
