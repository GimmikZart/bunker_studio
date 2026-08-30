import { workerRegistrationSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

export async function POST(request: Request) {
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
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = workerRegistrationSchema.parse(await request.json());
    return NextResponse.json(
      {
        worker: await operations.registerWorker({ ...input, organizationId, actorUserId: actorId }),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid worker registration.' }, { status: 400 });
  }
}
