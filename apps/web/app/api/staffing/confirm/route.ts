import { staffingConfirmationSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { tenantStore } from '../../_store';

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  try {
    const input = staffingConfirmationSchema.parse(await request.json());
    if (!input.confirmed) return NextResponse.json({ hired: [], confirmed: false });
    const hired = input.agents.map((agent) =>
      tenantStore.createAgent({ ...agent, organizationId, actorUserId: actorId }),
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
