import { workerHeartbeatSchema } from '@bunker-studio/contracts';
import {
  SupabaseAgentRepository,
  SupabaseTenancyRepository,
  type SupabaseDataClient,
} from '@bunker-studio/db';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { advanceProject } from '../../../../_conductor';
import { SupabaseOperationalRepository } from '../../../../_supabase-operations';
import { createWorkerServiceSupabaseClient } from '../../../../_supabase';

/**
 * The studio moving its projects on while nobody is looking at it.
 *
 * A worker finishing a task is the moment most likely to release the next one,
 * and there is no browser open to notice. The worker calls this with the
 * credential it already holds; the studio then acts as the organization's
 * owner, which is the account whose budget, permissions and inbox the work
 * belongs to anyway — never with more reach than that.
 */
export async function POST(request: Request): Promise<NextResponse> {
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
    const node = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !node)
      return NextResponse.json(
        { error: 'Worker credential is invalid or revoked.' },
        { status: 401 },
      );
    const organizationId = typeof node.organization_id === 'string' ? node.organization_id : '';
    if (!organizationId)
      return NextResponse.json({ error: 'This worker serves no organization.' }, { status: 403 });

    const { data: organization } = await client
      .from('organizations')
      .select('owner_user_id')
      .eq('id', organizationId)
      .maybeSingle();
    const ownerUserId = (organization as { owner_user_id?: unknown } | null)?.owner_user_id;
    if (typeof ownerUserId !== 'string')
      return NextResponse.json({ error: 'The organization has no owner.' }, { status: 409 });

    const dataClient = client as unknown as SupabaseDataClient;
    const operations = new SupabaseOperationalRepository(dataClient);
    const agents = new SupabaseAgentRepository(dataClient);
    const tenancy = new SupabaseTenancyRepository(dataClient);
    const projects = (await tenancy.listProjects(organizationId, ownerUserId)).filter(
      (project) => project.status === 'ACTIVE' && !project.archivedAt,
    );
    let moved = 0;
    for (const project of projects) {
      const result = await advanceProject({
        project,
        organizationId,
        actorId: ownerUserId,
        operations,
        agents,
      }).catch(() => null);
      moved += result?.moves.length ?? 0;
    }
    return NextResponse.json({ projects: projects.length, moves: moved });
  } catch (error) {
    return NextResponse.json(
      {
        error: `The projects could not be advanced. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
