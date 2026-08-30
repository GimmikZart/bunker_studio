import { designVersionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { listDesignVersions, submitDesignVersion, tenantStore } from '../_store';

export async function GET(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  return NextResponse.json({ versions: listDesignVersions(organizationId) });
}

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = designVersionSchema.parse(await request.json());
    const version = submitDesignVersion(organizationId, {
      version: input.versionNumber,
      spec: input.spec,
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid design version payload.' }, { status: 400 });
  }
}
