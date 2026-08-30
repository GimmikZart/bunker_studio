import { meetingCreateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { createMeeting, listMeetings, tenantStore } from '../_store';

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  return NextResponse.json({ meetings: listMeetings(organizationId) });
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = meetingCreateSchema.parse(await request.json());
    const project = tenantStore
      .listProjects(organizationId, actorId)
      .find((item) => item.id === input.projectId);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    input.agentIds.forEach((agentId) => tenantStore.getAgent(agentId, organizationId, actorId));
    return NextResponse.json(
      { meeting: createMeeting({ organizationId, ...input }) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid meeting payload.' }, { status: 400 });
  }
}
