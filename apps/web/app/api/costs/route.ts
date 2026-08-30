import { forecastMonthlyCost, weeklyCostReport } from '@bunker-studio/core';
import { costEntrySchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { addCost, listCosts, tenantStore } from '../_store';

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const entries = listCosts(organizationId);
  return NextResponse.json({
    entries,
    weekly: weeklyCostReport(entries),
    monthlyForecast: forecastMonthlyCost(entries),
  });
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const role = tenantStore.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json({ error: 'Owner or admin cost entry is required.' }, { status: 403 });
  try {
    const input = costEntrySchema.parse(await request.json());
    const entry = addCost({
      ...input,
      organizationId,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid cost entry.' }, { status: 400 });
  }
}
