import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';
import { persistenceTarget } from '../_persistence';

export async function GET(request: Request) {
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
  try {
    const role = await operations.getRole(organizationId, actorId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({
      role,
      providers: await operations.listProviders(organizationId, actorId),
      workers: await operations.listWorkers(organizationId, actorId),
      runtime: {
        mode: 'Durable worker queue',
        providerSelection: 'Provider and model are selected per agent',
        workerRequired: true,
      },
      // Lets the UI say up front that a key cannot be stored yet, instead of
      // failing after someone has already pasted a secret into the form.
      secureProviderStorage: Boolean(process.env.STUDIO_MASTER_KEY),
      // Which database this run is actually writing to. Host only, no credential.
      persistence: persistenceTarget(),
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
