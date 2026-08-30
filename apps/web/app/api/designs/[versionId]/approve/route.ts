import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebOperationalRepository } from '../../../_data';

export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (role !== 'OWNER')
    return NextResponse.json({ error: 'Owner approval is required.' }, { status: 403 });
  const { versionId } = await context.params;
  try {
    const approved = await operations.approveDesignVersion(organizationId, versionId, actorId);
    return NextResponse.json({ versions: approved });
  } catch {
    return NextResponse.json(
      { error: 'Only a submitted design can be approved.' },
      { status: 409 },
    );
  }
}
