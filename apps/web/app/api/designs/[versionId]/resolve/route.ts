import { designResolutionSchema } from '@bunker-studio/contracts';
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
    return NextResponse.json({ error: 'Owner design resolution is required.' }, { status: 403 });
  const { versionId } = await context.params;
  try {
    const { decision } = designResolutionSchema.parse(await request.json());
    const versions = await operations.resolveDesignVersion(
      organizationId,
      versionId,
      decision,
      actorId,
    );
    await operations
      .recordActivity({
        organizationId,
        eventType: `DESIGN_${decision}`,
        aggregateType: 'design_version',
        aggregateId: versionId,
        payload: { actorUserId: actorId },
      })
      .catch(() => undefined);
    return NextResponse.json({ versions });
  } catch {
    return NextResponse.json(
      { error: 'Only a submitted design can be resolved.' },
      { status: 409 },
    );
  }
}
