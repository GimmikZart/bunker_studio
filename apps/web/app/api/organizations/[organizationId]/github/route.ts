import { githubConnectionCreateSchema } from '@bunker-studio/contracts';
import { encryptSecret } from '@bunker-studio/db';
import { createGitHubApi, GitHubApiError } from '@bunker-studio/git';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { githubStorageFailure } from '../../../_github-errors';
import { getWebOperationalRepository } from '../../../_data';

/**
 * The GitHub account belongs to the organization. Connecting it here, once, is
 * what lets a new project pick a repository from a list instead of retyping
 * owner, repository and branch every time.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    return NextResponse.json({
      connections: await operations.listGitHubConnections(organizationId, actorId),
    });
  } catch (error) {
    return githubStorageFailure(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin access is required to connect a GitHub account.' },
      { status: 403 },
    );
  // Parsed on its own so a malformed body is the only thing reported as one.
  let input: ReturnType<typeof githubConnectionCreateSchema.parse>;
  try {
    input = githubConnectionCreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'A GitHub access token is required.' }, { status: 400 });
  }
  const masterKey = process.env.STUDIO_MASTER_KEY;
  if (!masterKey)
    return NextResponse.json(
      {
        error:
          'Secure credential storage is not configured. Set STUDIO_MASTER_KEY before connecting GitHub.',
      },
      { status: 503 },
    );
  try {
    const account = await createGitHubApi({
      token: input.accessToken,
    }).getAuthenticatedAccount();
    const connection = await operations.saveGitHubConnection(
      {
        organizationId,
        accountLogin: account.login,
        accountType: account.type,
        encryptedSecret: encryptSecret(input.accessToken, masterKey) as unknown as Record<
          string,
          unknown
        >,
      },
      actorId,
    );
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /github_connections/.test(error.message))
      return githubStorageFailure(error);
    if (error instanceof GitHubApiError)
      return NextResponse.json(
        {
          error:
            error.status === 401
              ? 'GitHub did not accept the token. Check it was copied whole, has not expired, and has not been revoked.'
              : `GitHub refused the request with status ${error.status}.`,
        },
        { status: error.status === 401 ? 409 : 502 },
      );
    return NextResponse.json(
      {
        error: `The GitHub account could not be connected. ${
          error instanceof Error
            ? error.message.replace(/gh[ps]_\w+|github_pat_\w+/g, '[REDACTED]')
            : 'Unknown failure.'
        }`,
      },
      { status: 502 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const connectionId = new URL(request.url).searchParams.get('connectionId')?.trim();
  if (!actorId || !connectionId)
    return NextResponse.json(
      { error: 'Authentication and a connection are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin access is required to remove a GitHub account.' },
      { status: 403 },
    );
  try {
    const removed = await operations.deleteGitHubConnection(organizationId, connectionId, actorId);
    if (!removed) return NextResponse.json({ error: 'GitHub account not found.' }, { status: 404 });
  } catch (error) {
    return githubStorageFailure(error);
  }
  return new NextResponse(null, { status: 204 });
}
