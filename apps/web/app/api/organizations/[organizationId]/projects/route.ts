import { projectCreateSchema, projectUpdateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { tenantStore } from '../../../_store';

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  const actorUserId = await resolveActorId(request);
  if (!actorUserId)
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const input = projectCreateSchema.parse(await request.json());
    return NextResponse.json(
      { project: tenantStore.createProject({ ...input, organizationId, actorUserId }) },
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
  if (!actorUserId)
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    return NextResponse.json({ projects: tenantStore.listProjects(organizationId, actorUserId) });
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
  if (!actorUserId || !projectId)
    return NextResponse.json(
      { error: 'Authentication and project are required.' },
      { status: 401 },
    );
  try {
    return NextResponse.json({
      project: tenantStore.updateProject(
        projectId,
        organizationId,
        actorUserId,
        projectUpdateSchema.parse(await request.json()),
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid project payload.' }, { status: 400 });
  }
}
