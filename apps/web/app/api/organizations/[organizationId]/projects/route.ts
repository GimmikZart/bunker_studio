import { projectCreateSchema, projectUpdateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebTenancyRepository } from '../../../_data';

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  const actorUserId = await resolveActorId(request);
  const store = await getWebTenancyRepository();
  if (!actorUserId)
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = projectCreateSchema.parse(await request.json());
    return NextResponse.json(
      { project: await store.createProject({ ...input, organizationId, actorUserId }) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid project payload.' }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorUserId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const store = await getWebTenancyRepository();
  if (!actorUserId)
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({ projects: await store.listProjects(organizationId, actorUserId) });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorUserId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const projectId = new URL(request.url).searchParams.get('projectId');
  const store = await getWebTenancyRepository();
  if (!actorUserId || !projectId)
    return NextResponse.json(
      { error: 'Authentication and project are required.' },
      { status: 401 },
    );
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = projectUpdateSchema.parse(await request.json());
    return NextResponse.json({
      project: await store.updateProject(projectId, organizationId, actorUserId, {
        ...input,
        defaultTeamId: input.teamId,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid project payload.' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorUserId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const projectId = new URL(request.url).searchParams.get('projectId');
  const store = await getWebTenancyRepository();
  if (!actorUserId || !projectId)
    return NextResponse.json(
      { error: 'Authentication and project are required.' },
      { status: 401 },
    );
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    await store.archiveProject(projectId, organizationId, actorUserId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }
}
