import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

export async function DELETE(request: Request, context: { params: Promise<{ workerId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin worker revocation is required.' },
      { status: 403 },
    );
  const { workerId } = await context.params;
  try {
    const worker = await operations.revokeWorker(workerId, organizationId, actorId);
    return worker
      ? NextResponse.json({ worker })
      : NextResponse.json({ error: 'Worker not found or already revoked.' }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Worker revocation failed.' }, { status: 409 });
  }
}
