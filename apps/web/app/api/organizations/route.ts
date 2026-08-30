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
  try {
    const input = organizationCreateSchema.parse(await request.json());
    const organization = await store.createOrganization({ ...input, ownerUserId: userId });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid organization payload.' }, { status: 400 });
  }
}
