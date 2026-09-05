import { projectAgentsAssignSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { advanceProject } from '../../../_conductor';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../../_data';

type Context = { params: Promise<{ projectId: string }> };

/**
 * Who works on a project.
 *
 * This is the only surface for it: an assignment used to be reachable only
 * through the API, so a plan could be generated for a project that had nobody
 * on it and the tasks it produced could never be claimed.
 */
type Resolved =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      organizationId: string;
      actorId: string;
      agents: NonNullable<Awaited<ReturnType<typeof getWebAgentRepository>>>;
      operations: NonNullable<Awaited<ReturnType<typeof getWebOperationalRepository>>>;
      project: { id: string; autonomyMode: string };
    };

async function context(request: Request, projectId: string): Promise<Resolved> {
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
  const agents = await getWebAgentRepository();
  const tenancy = await getWebTenancyRepository();
  const operations = await getWebOperationalRepository();
  if (!agents || !tenancy || !operations)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 }),
    };
  // The project is checked against the organization in the header, so a project
  // id from another tenant cannot be staffed by guessing it.
  const project = (await tenancy.listProjects(organizationId, actorId)).find(
    (candidate) => candidate.id === projectId,
  );
  if (!project)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found.' }, { status: 404 }),
    };
  return { ok: true, organizationId, actorId, agents, operations, project };
}

function failure(error: unknown): NextResponse {
  if (error instanceof Error && error.name === 'AuthorizationError')
    return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof Error && error.name === 'ZodError')
    return NextResponse.json({ error: 'Invalid assignment payload.' }, { status: 400 });
  return NextResponse.json(
    {
      error: `The project team could not be changed. ${
        error instanceof Error ? error.message : 'Unknown failure.'
      }`,
    },
    { status: 500 },
  );
}

export async function GET(request: Request, routeContext: Context): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const resolved = await context(request, projectId);
  if (!resolved.ok) return resolved.response;
  const { organizationId, actorId, agents } = resolved;
  try {
    const [assignments, roster] = await Promise.all([
      agents.listAssignments(organizationId, actorId),
      agents.listAgents(organizationId, actorId),
    ]);
    const onProject = assignments.filter((assignment) => assignment.projectId === projectId);
    const byId = new Map(roster.filter((agent) => !agent.archivedAt).map((a) => [a.id, a]));
    return NextResponse.json({
      // An assignment whose agent has been archived is not a team member any
      // more; it is left in place but never presented as one.
      members: onProject.flatMap((assignment) => {
        const agent = byId.get(assignment.agentId);
        if (!agent) return [];
        return [
          {
            assignmentId: assignment.id,
            id: agent.id,
            name: agent.name,
            title: agent.title,
            roleKey: agent.roleKey,
            avatarAssetId: agent.avatarAssetId,
            skills: agent.skills,
          },
        ];
      }),
      available: [...byId.values()]
        .filter((agent) => !onProject.some((assignment) => assignment.agentId === agent.id))
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          title: agent.title,
          roleKey: agent.roleKey,
          avatarAssetId: agent.avatarAssetId,
        })),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, routeContext: Context): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const resolved = await context(request, projectId);
  if (!resolved.ok) return resolved.response;
  const { organizationId, actorId, agents } = resolved;
  try {
    const input = projectAgentsAssignSchema.parse(await request.json());
    const assignments = await agents.listAssignments(organizationId, actorId);
    for (const agentId of input.agentIds) {
      // Already here: leave the existing assignment alone rather than stacking a
      // second one that would show the same person twice.
      if (
        assignments.some(
          (assignment) => assignment.projectId === projectId && assignment.agentId === agentId,
        )
      )
        continue;
      await agents.createAgentAssignment({
        organizationId,
        actorUserId: actorId,
        agentId,
        projectId,
      });
    }
    // A move only releases the old project once the new assignment exists, so a
    // failure halfway leaves the agent staffed rather than nowhere.
    if (input.fromProjectId)
      for (const assignment of assignments)
        if (
          assignment.projectId === input.fromProjectId &&
          input.agentIds.includes(assignment.agentId)
        )
          await agents.archiveAgentAssignment(assignment.id, organizationId, actorId);
    // Somebody joining the project can unblock work that had nobody to do it,
    // so the queue is reconsidered straight away rather than at the next visit.
    const advanced = await advanceProject({
      project: resolved.project,
      organizationId,
      actorId,
      operations: resolved.operations,
      agents,
    }).catch(() => null);
    return NextResponse.json(
      { assigned: input.agentIds.length, ...(advanced ? { advanced } : {}) },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, routeContext: Context): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const resolved = await context(request, projectId);
  if (!resolved.ok) return resolved.response;
  const { organizationId, actorId, agents } = resolved;
  const agentId = new URL(request.url).searchParams.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'An agent is required.' }, { status: 400 });
  try {
    const assignments = (await agents.listAssignments(organizationId, actorId)).filter(
      (assignment) => assignment.projectId === projectId && assignment.agentId === agentId,
    );
    if (!assignments.length)
      return NextResponse.json({ error: 'That agent is not on this project.' }, { status: 404 });
    for (const assignment of assignments)
      await agents.archiveAgentAssignment(assignment.id, organizationId, actorId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
