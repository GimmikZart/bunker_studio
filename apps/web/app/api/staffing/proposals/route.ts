import { suggestStaffingTeam } from '@bunker-studio/core';
import { staffingRequestSchema } from '@bunker-studio/contracts';
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
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = staffingRequestSchema.parse(await request.json());
    return NextResponse.json({ proposals: suggestStaffingTeam(input) });
  } catch {
    return NextResponse.json({ error: 'Invalid staffing request.' }, { status: 400 });
  }
}
