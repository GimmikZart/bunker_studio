import { teamCreateSchema, teamUpdateSchema } from '@bunker-studio/contracts';
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
    const input = teamCreateSchema.parse(await request.json());
    return NextResponse.json(
      { team: await store.createTeam({ ...input, organizationId, actorUserId }) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid team payload.' }, { status: 400 });
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
    return NextResponse.json({ teams: await store.listTeams(organizationId, actorUserId) });
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
  const teamId = new URL(request.url).searchParams.get('teamId');
  const store = await getWebTenancyRepository();
  if (!actorUserId || !teamId)
    return NextResponse.json({ error: 'Authentication and team are required.' }, { status: 401 });
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({
      team: await store.updateTeam(
        teamId,
        organizationId,
        actorUserId,
        teamUpdateSchema.parse(await request.json()),
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid team payload.' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorUserId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const teamId = new URL(request.url).searchParams.get('teamId');
  const store = await getWebTenancyRepository();
  if (!actorUserId || !teamId)
    return NextResponse.json({ error: 'Authentication and team are required.' }, { status: 401 });
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    await store.archiveTeam(teamId, organizationId, actorUserId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }
}
