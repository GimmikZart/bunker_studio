import { repositoryConnectionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getRepository, saveRepository, tenantStore } from '../../../_store';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { projectId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const project = tenantStore
    .listProjects(organizationId, actorId)
    .find((item) => item.id === projectId);
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  return NextResponse.json({ repository: getRepository(projectId) });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { projectId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const role = tenantStore.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin repository access is required.' },
      { status: 403 },
    );
  try {
    const input = repositoryConnectionSchema.parse({ ...(await request.json()), projectId });
    const project = tenantStore
      .listProjects(organizationId, actorId)
      .find((item) => item.id === projectId);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const repository = saveRepository({
      id: crypto.randomUUID(),
      organizationId,
      ...input,
      status: 'REQUIRES_AUTH',
    });
    return NextResponse.json({ repository }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid repository connection.' }, { status: 400 });
  }
}
