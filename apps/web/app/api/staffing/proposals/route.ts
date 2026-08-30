import { suggestStaffingTeam } from '@bunker-studio/core';
import { staffingRequestSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebTenancyRepository } from '../../_data';

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const tenancy = await getWebTenancyRepository();
  if (!tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await tenancy.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = staffingRequestSchema.parse(await request.json());
    return NextResponse.json({ proposals: suggestStaffingTeam(input) });
  } catch {
    return NextResponse.json({ error: 'Invalid staffing request.' }, { status: 400 });
  }
}
