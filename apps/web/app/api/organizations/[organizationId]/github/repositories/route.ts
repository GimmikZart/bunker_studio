import { decryptSecret, type EncryptedSecret } from '@bunker-studio/db';
import { createGitHubApi, GitHubApiError } from '@bunker-studio/git';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../../_auth';
import { getWebOperationalRepository } from '../../../../_data';
import { githubStorageFailure } from '../../../../_github-errors';

/**
 * The repositories a connected account can already reach. This is what makes
 * creating a project a choice from a list rather than three typed identifiers.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  const connectionId = new URL(request.url).searchParams.get('connectionId')?.trim();
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!connectionId)
    return NextResponse.json({ error: 'A GitHub account is required.' }, { status: 400 });
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const masterKey = process.env.STUDIO_MASTER_KEY;
  if (!masterKey)
    return NextResponse.json(
      { error: 'Secure credential storage is not configured.' },
      { status: 503 },
    );
  let stored: Awaited<ReturnType<typeof operations.getGitHubConnectionSecret>>;
  try {
    stored = await operations.getGitHubConnectionSecret(organizationId, connectionId, actorId);
  } catch (error) {
    return githubStorageFailure(error);
  }
  if (!stored) return NextResponse.json({ error: 'GitHub account not found.' }, { status: 404 });
  try {
    const repositories = await createGitHubApi({
      token: decryptSecret(stored.encryptedSecret as unknown as EncryptedSecret, masterKey),
    }).listAccessibleRepositories();
    return NextResponse.json({ account: stored.connection, repositories });
  } catch (error) {
    if (error instanceof GitHubApiError)
      return NextResponse.json(
        {
          error:
            error.status === 401
              ? `GitHub no longer accepts the token stored for ${stored.connection.accountLogin}. Reconnect the account in Settings.`
              : `GitHub refused the request with status ${error.status}.`,
        },
        { status: error.status === 401 ? 409 : 502 },
      );
    return NextResponse.json(
      { error: 'The repository list could not be read from GitHub.' },
      { status: 502 },
    );
  }
}
