import { workerHeartbeatSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

export async function POST(request: Request) {
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
  try {
    const { nodeId } = workerHeartbeatSchema.parse(await request.json());
    const node = await operations.getWorker(nodeId, organizationId, actorId);
    if (!node) return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    return NextResponse.json({
      worker: await operations.heartbeatWorker(nodeId, organizationId, actorId),
    });
  } catch {
    return NextResponse.json({ error: 'Worker heartbeat rejected.' }, { status: 409 });
  }
}
