import { staffingConfirmationSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebAgentRepository } from '../../_data';

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = staffingConfirmationSchema.parse(await request.json());
    if (!input.confirmed) return NextResponse.json({ hired: [], confirmed: false });
    const hired = await Promise.all(
      input.agents.map((agent) =>
        store.createAgent({ ...agent, organizationId, actorUserId: actorId }),
      ),
    );
    return NextResponse.json({ hired, confirmed: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json(
        { error: 'Owner or admin confirmation is required.' },
        { status: 403 },
      );
    return NextResponse.json({ error: 'Invalid staffing confirmation.' }, { status: 400 });
  }
}
