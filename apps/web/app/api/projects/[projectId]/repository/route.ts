import { repositoryConnectionSchema } from '@bunker-studio/contracts';
import { encryptSecret } from '@bunker-studio/db';
import { createGitHubApi, GitHubApiError } from '@bunker-studio/git';
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
  // Parsed on its own so a malformed body is the only thing reported as one.
  let input: ReturnType<typeof repositoryConnectionSchema.parse>;
  try {
    input = repositoryConnectionSchema.parse({ ...(await request.json()), projectId });
  } catch {
    return NextResponse.json({ error: 'Invalid repository connection.' }, { status: 400 });
  }
  try {
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
  } catch (error) {
    // GitHub refusing the token is not a malformed request. Say which of the
    // three likely causes it was, because they need different fixes.
    if (error instanceof GitHubApiError) {
      if (error.status === 401)
        return NextResponse.json(
          {
            error:
              'GitHub did not accept the token. Check it was copied whole, has not expired, and has not been revoked.',
          },
          { status: 409 },
        );
      if (error.status === 404)
        return NextResponse.json(
          {
            error: `GitHub reports no repository ${input.owner}/${input.name} reachable with this token, or the branch ${input.defaultBranch} does not exist. A fine-grained token only sees repositories selected under Repository access.`,
          },
          { status: 409 },
        );
      if (error.status === 403)
        return NextResponse.json(
          {
            error:
              'The token reached GitHub but is not allowed to read this repository. Grant it Contents read/write and Pull requests read/write, and check the resource owner matches the repository owner.',
          },
          { status: 409 },
        );
      return NextResponse.json(
        { error: `GitHub refused the request with status ${error.status}.` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: `The repository could not be connected. ${
          error instanceof Error
            ? error.message.replace(/gh[ps]_\w+|github_pat_\w+/g, '[REDACTED]')
            : 'Unknown failure.'
        }`,
      },
      { status: 502 },
    );
  }
}
