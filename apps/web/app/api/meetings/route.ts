import { meetingCreateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../_data';

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  return NextResponse.json({ meetings: await operations.listMeetings(organizationId, actorId) });
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  const agents = await getWebAgentRepository();
  if (!operations || !tenancy || !agents)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = meetingCreateSchema.parse(await request.json());
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (item) => item.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    await Promise.all(
      input.agentIds.map((agentId) => agents.getAgent(agentId, organizationId, actorId)),
    );
    return NextResponse.json(
      { meeting: await operations.createMeeting({ organizationId, ...input }, actorId) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid meeting payload.' }, { status: 400 });
  }
}
