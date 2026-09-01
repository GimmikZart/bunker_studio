import { repositoryConnectionSchema } from '@bunker-studio/contracts';
import { encryptSecret } from '@bunker-studio/db';
import { createGitHubApi } from '@bunker-studio/git';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebOperationalRepository, getWebTenancyRepository } from '../../../_data';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { projectId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const project = (await tenancy.listProjects(organizationId, actorId)).find(
    (item) => item.id === projectId,
  );
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  return NextResponse.json({
    repository: await operations.getRepository(projectId, organizationId, actorId),
  });
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
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin repository access is required.' },
      { status: 403 },
    );
  try {
    const input = repositoryConnectionSchema.parse({ ...(await request.json()), projectId });
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (item) => item.id === projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const masterKey = process.env.STUDIO_MASTER_KEY;
    if (input.accessToken && !masterKey)
      return NextResponse.json(
        { error: 'Secure repository credential storage is not configured.' },
        { status: 503 },
      );
    if (input.providerType !== 'GITHUB')
      return NextResponse.json(
        { error: 'Only GitHub repository execution is available in this release.' },
        { status: 409 },
      );
    if (input.accessToken) {
      const access = await createGitHubApi({ token: input.accessToken }).verifyRepositoryAccess(
        { owner: input.owner, name: input.name },
        input.defaultBranch,
      );
      if (!access.canPush)
        return NextResponse.json(
          { error: 'The GitHub token can read this repository but cannot push task branches.' },
          { status: 409 },
        );
    }
    const repository = await operations.saveRepository(
      {
        id: crypto.randomUUID(),
        organizationId,
        projectId: input.projectId,
        providerType: input.providerType,
        owner: input.owner,
        name: input.name,
        defaultBranch: input.defaultBranch,
        status: input.accessToken ? 'CONNECTED' : 'REQUIRES_AUTH',
      },
      actorId,
      input.accessToken && masterKey ? encryptSecret(input.accessToken, masterKey) : undefined,
    );
    return NextResponse.json({ repository }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid repository connection.' }, { status: 400 });
  }
}
