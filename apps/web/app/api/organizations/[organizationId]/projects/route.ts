import { projectCreateSchema, projectUpdateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebTenancyRepository } from '../../../_data';

/**
 * Says what actually went wrong. Every failure used to be answered with
 * "Invalid project payload", so a name already taken, a database that had not
 * been migrated and a genuinely malformed body were indistinguishable — and the
 * form the user was told to fix had nothing wrong with it.
 */
function projectFailureResponse(error: unknown): NextResponse {
  if (error instanceof Error && error.name === 'AuthorizationError')
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (error instanceof Error && error.name === 'ConflictError')
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.name === 'ZodError') {
    const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;
    const detail = issues
      ?.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    return NextResponse.json(
      { error: detail ? `Invalid project payload. ${detail}` : 'Invalid project payload.' },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error: `The project could not be saved. ${
        error instanceof Error ? error.message : 'Unknown failure.'
      }`,
    },
    { status: 500 },
  );
}

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
    return projectFailureResponse(error);
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
        teamIds: input.teamIds,
      }),
    });
  } catch (error) {
    return projectFailureResponse(error);
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
