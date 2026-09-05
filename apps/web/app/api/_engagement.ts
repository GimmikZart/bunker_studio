import { NextResponse } from 'next/server';
import { resolveActorId } from './_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from './_data';

/** The conversation with the Lead is kept apart from that agent's free chat. */
export function engagementSession(projectId: string): string {
  return `engagement:${projectId}`;
}

export type EngagementContext =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      organizationId: string;
      actorId: string;
      project: { id: string; name: string; autonomyMode: string };
      operations: NonNullable<Awaited<ReturnType<typeof getWebOperationalRepository>>>;
      agents: NonNullable<Awaited<ReturnType<typeof getWebAgentRepository>>>;
    };

export async function engagementContext(
  request: Request,
  projectId: string,
): Promise<EngagementContext> {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication and organization are required.' },
        { status: 401 },
      ),
    };
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !agents || !tenancy)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 }),
    };
  const project = (await tenancy.listProjects(organizationId, actorId)).find(
    (candidate) => candidate.id === projectId,
  );
  if (!project)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found.' }, { status: 404 }),
    };
  return { ok: true, organizationId, actorId, project, operations, agents };
}

/**
 * The Lead of this project.
 *
 * Deliberately the project's own, not any lead in the organization: the brief
 * belongs to the people who will do the work, and an agent nobody put on the
 * project has no business writing it.
 */
export async function projectLead(
  context: Extract<EngagementContext, { ok: true }>,
): Promise<{ id: string; name: string; title: string } | null> {
  const [roster, assignments] = await Promise.all([
    context.agents.listAgents(context.organizationId, context.actorId),
    context.agents.listAssignments(context.organizationId, context.actorId),
  ]);
  const staffed = new Set(
    assignments
      .filter((assignment) => assignment.projectId === context.project.id)
      .map((assignment) => assignment.agentId),
  );
  return (
    roster.find(
      (agent) => staffed.has(agent.id) && agent.roleKey === 'lead' && !agent.archivedAt,
    ) ?? null
  );
}

export const BRIEF_MEMORY_PREFIX = 'Approved brief:';
