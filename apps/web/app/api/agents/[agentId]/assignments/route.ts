import { agentAssignmentSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebAgentRepository, getWebOperationalRepository } from '../../../_data';

type Context = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, context: Context) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const repository = await getWebAgentRepository();
  if (!repository)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({
      assignments: await repository.listAgentAssignments(agentId, organizationId, actorId),
    });
  } catch {
    return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
  }
}

export async function POST(request: Request, context: Context) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const repository = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!repository || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = agentAssignmentSchema.parse(await request.json());
    const assignment = await repository.createAgentAssignment({
      ...input,
      agentId,
      organizationId,
      actorUserId: actorId,
    });
    await operations
      .recordActivity({
        organizationId,
        eventType: 'AGENT_ASSIGNMENT_CREATED',
        aggregateType: 'agent_assignment',
        aggregateId: assignment.id,
        payload: { actorUserId: actorId, agentId },
      })
      .catch(() => undefined);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: 'Invalid assignment payload.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  const assignmentId = new URL(request.url).searchParams.get('assignmentId');
  if (!organizationId || !actorId || !assignmentId)
    return NextResponse.json(
      { error: 'Authentication, organization and assignment are required.' },
      { status: 401 },
    );
  const repository = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!repository || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    await repository.archiveAgentAssignment(assignmentId, organizationId, actorId);
    await operations
      .recordActivity({
        organizationId,
        eventType: 'AGENT_ASSIGNMENT_ARCHIVED',
        aggregateType: 'agent_assignment',
        aggregateId: assignmentId,
        payload: { actorUserId: actorId },
      })
      .catch(() => undefined);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
  }
}
