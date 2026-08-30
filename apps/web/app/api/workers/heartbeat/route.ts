import { workerHeartbeatSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { workerRegistry } from '../../_store';

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  try {
    const { nodeId } = workerHeartbeatSchema.parse(await request.json());
    const node = workerRegistry.get(nodeId);
    if (!node || node.organizationId !== organizationId)
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    return NextResponse.json({ worker: workerRegistry.heartbeat(nodeId) });
  } catch {
    return NextResponse.json({ error: 'Worker heartbeat rejected.' }, { status: 409 });
  }
}
