import { canWrite } from '@bunker-studio/core';
import { decryptSecret, type EncryptedSecret } from '@bunker-studio/db';
import { createGitHubApi, githubCiVerificationRuns } from '@bunker-studio/git';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebOperationalRepository } from '../../../_data';
import { createWorkerServiceSupabaseClient } from '../../../_supabase';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('GitHub CI persistence returned invalid data.');
  return value as Record<string, unknown>;
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { taskId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const client = createWorkerServiceSupabaseClient();
  if (!operations || !client)
    return NextResponse.json(
      { error: 'Supabase service persistence is required to refresh GitHub CI.' },
      { status: 503 },
    );
  try {
    const role = await operations.getRole(organizationId, actorId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    if (!canWrite(role))
      return NextResponse.json(
        { error: 'Owner or admin access is required to refresh CI.' },
        { status: 403 },
      );
    const task = (await operations.listTasks(organizationId, actorId)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    if (!task.candidateCommitSha || !task.candidateBranch)
      return NextResponse.json(
        { error: 'The task has no published candidate commit.' },
        { status: 409 },
      );
    const masterKey = process.env.STUDIO_MASTER_KEY;
    if (!masterKey)
      return NextResponse.json(
        { error: 'Secure repository credential access is not configured.' },
        { status: 503 },
      );
    const repositoryResponse = await client
      .from('repo_connections')
      .select('provider_type, repo_owner, repo_name, default_branch, status, encrypted_auth_blob')
      .eq('project_id', task.projectId)
      .eq('organization_id', organizationId)
      .eq('status', 'CONNECTED')
      .maybeSingle();
    if (repositoryResponse.error || !repositoryResponse.data)
      return NextResponse.json(
        { error: 'Connected GitHub repository not found.' },
        { status: 409 },
      );
    const repository = record(repositoryResponse.data);
    if (
      repository.provider_type !== 'GITHUB' ||
      typeof repository.repo_owner !== 'string' ||
      typeof repository.repo_name !== 'string' ||
      !repository.encrypted_auth_blob ||
      typeof repository.encrypted_auth_blob !== 'object'
    )
      return NextResponse.json({ error: 'GitHub repository is not ready.' }, { status: 409 });
    const token = decryptSecret(
      record(repository.encrypted_auth_blob) as EncryptedSecret,
      masterKey,
    );
    const ci = await createGitHubApi({ token }).getCiEvidence(
      { owner: repository.repo_owner, name: repository.repo_name },
      task.candidateCommitSha,
    );
    if (ci.commitSha !== task.candidateCommitSha)
      return NextResponse.json(
        { error: 'GitHub CI returned evidence for a different commit.' },
        { status: 409 },
      );
    const checkedAt = new Date().toISOString();
    const taskUpdate = await client
      .from('tasks')
      .update({ candidate_ci_status: ci.status, candidate_ci_checked_at: checkedAt })
      .eq('id', task.id)
      .eq('organization_id', organizationId);
    if (taskUpdate.error) throw new Error('Task CI status update failed.');
    const verificationRuns = githubCiVerificationRuns(ci);
    const verificationUpdate = await client.from('verification_runs').upsert(
      verificationRuns.map((run) => ({
        organization_id: organizationId,
        task_id: task.id,
        kind: run.kind,
        command_or_check: run.commandOrCheck,
        status: run.status,
        duration_ms: run.durationMs,
        external_key: run.externalKey,
        executed_at: checkedAt,
      })),
      { onConflict: 'task_id,external_key' },
    );
    if (verificationUpdate.error) throw new Error('GitHub CI evidence update failed.');
    return NextResponse.json({ ci, verificationRuns, checkedAt });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'GitHub CI refresh failed.' }, { status: 503 });
  }
}
