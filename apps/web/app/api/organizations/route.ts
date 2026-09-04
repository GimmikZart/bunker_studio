import { organizationCreateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebTenancyRepository } from '../_data';

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
}

export async function GET(request: Request) {
  const userId = await resolveActorId(request);
  if (!userId) return unauthorized();
  const store = await getWebTenancyRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  return NextResponse.json({ organizations: await store.listOrganizations(userId) });
}

export async function POST(request: Request) {
  const userId = await resolveActorId(request);
  if (!userId) return unauthorized();
  const store = await getWebTenancyRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  // Parsed on its own so a bad body is the only thing reported as a bad body.
  let input: ReturnType<typeof organizationCreateSchema.parse>;
  try {
    input = organizationCreateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    return NextResponse.json({ error: 'Invalid organization payload.' }, { status: 400 });
  }
  try {
    const organization = await store.createOrganization({ ...input, ownerUserId: userId });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    // A storage failure is not a bad request: report what the database said so
    // a misconfigured project or policy is diagnosable.
    return NextResponse.json(
      {
        error: `The organization could not be created. ${
          error instanceof Error ? error.message : 'Unknown storage failure.'
        }`,
      },
      { status: 502 },
    );
  }
}
